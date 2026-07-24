import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, effect, signal } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { FinanceSummary } from '../compta-finance.model';

Chart.register(...registerables);

/**
 * Port direct (non ng2-charts) du graphique Chart.js de compta.html (lignes 311-367) :
 * on reconstruit l'instance à chaque changement de données, comme `chartInstance.destroy()`
 * puis `new Chart(...)` dans l'original.
 */
@Component({
  selector: 'app-bankroll-chart',
  standalone: true,
  template: `<canvas #canvas></canvas>`,
  host: { class: 'block relative w-full h-full' },
})
export class BankrollChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly summarySignal = signal<FinanceSummary | null>(null);
  @Input({ required: true }) set summary(value: FinanceSummary) {
    this.summarySignal.set(value);
  }

  private chart: Chart<'line', number[], string> | null = null;
  // Cf. classement/elo-chart.component.ts : `canvasRef` n'étant pas un signal, l'effect()
  // doit être gardé par un flag mis à jour dans ngAfterViewInit pour ne pas rater le tout
  // premier rendu si le ViewChild n'est pas encore résolu lors du premier passage.
  private viewReady = false;

  constructor() {
    effect(() => {
      const summary = this.summarySignal();
      if (summary && this.viewReady) this.renderChart(summary);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    const summary = this.summarySignal();
    if (summary) this.renderChart(summary);
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(summary: FinanceSummary): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.chart?.destroy();

    const displayPoints = summary.chartPoints.length > 0 ? summary.chartPoints : [{ x: '—', y: 0 }];
    const lineColor = summary.totalPnL >= 0 ? '#34d399' : '#f87171';

    const config: ChartConfiguration<'line', number[], string> = {
      type: 'line',
      data: {
        labels: displayPoints.map((p) => p.x),
        datasets: [
          {
            label: 'Banque cumulée',
            data: displayPoints.map((p) => p.y),
            borderColor: lineColor,
            backgroundColor: summary.totalPnL >= 0 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: lineColor,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: lineColor,
            pointRadius: displayPoints.length > 40 ? 0 : 3,
            fill: true,
            tension: 0.25,
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
            callbacks: {
              label: (item) => {
                const y = item.parsed.y ?? 0;
                return `${y >= 0 ? '+' : ''}${y}$`;
              },
            },
          },
        },
        scales: {
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.5)' },
            border: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter' }, callback: (v) => v + '$' },
          },
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter' }, maxTicksLimit: 10 },
          },
        },
      },
    };

    this.chart = new Chart(ctx, config);
  }
}
