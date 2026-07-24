import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, effect, signal } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { HistoryEntry, Player } from '../../../core/models';
import { buildEloChartData } from '../classement.util';

Chart.register(...registerables);

@Component({
  selector: 'app-elo-chart',
  standalone: true,
  templateUrl: './elo-chart.component.html',
  // Sans ce host binding, <app-elo-chart> reste `display:inline` (défaut des éléments
  // inconnus) et ne récupère jamais la hauteur réelle du conteneur flex parent : le
  // canvas garde alors sa taille native 300x150 et le graphique ne s'affiche pas.
  host: { class: 'block relative w-full h-full' },
})
export class EloChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly playerInput = signal<Player | null>(null);
  @Input() set player(value: Player | null | undefined) {
    this.playerInput.set(value ?? null);
  }

  private readonly matchesInput = signal<HistoryEntry[]>([]);
  @Input() set reversedMatches(value: HistoryEntry[] | undefined) {
    this.matchesInput.set(value ?? []);
  }

  private chart: Chart | null = null;
  // Le premier passage de l'effect() ci-dessous peut s'exécuter avant que le ViewChild du
  // canvas soit résolu (ngAfterViewInit n'a pas encore eu lieu) ; comme `canvasRef` n'est
  // pas un signal, l'effect ne se redéclenche jamais tout seul une fois la vue prête — d'où
  // ce flag, explicitement revérifié dans ngAfterViewInit.
  private viewReady = false;

  constructor() {
    effect(() => {
      const player = this.playerInput();
      const matches = this.matchesInput();
      if (this.viewReady) this.renderChart(player, matches);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart(this.playerInput(), this.matchesInput());
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(player: Player | null, matches: HistoryEntry[]): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!player || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = buildEloChartData(player, matches);

    this.chart?.destroy();
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map((d) => d.x),
        datasets: [
          {
            label: 'Points Elo',
            data: points.map((d) => d.y),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#818cf8',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#6366f1',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#cbd5e1',
            bodyColor: '#fff',
            bodyFont: { weight: 'bold' },
            borderColor: '#334155',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
          },
        },
        scales: {
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.5)' },
            ticks: { color: '#64748b', font: { family: 'Inter' } },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter' }, maxTicksLimit: 7 },
          },
        },
      },
    });
  }
}
