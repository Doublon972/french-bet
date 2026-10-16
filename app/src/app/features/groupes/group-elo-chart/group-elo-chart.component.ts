import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  signal,
} from '@angular/core';
import Chart from 'chart.js/auto';
import { Group, HistoryEntry } from '../../../core/models';
import { EloPoint, computeGroupEloHistory } from '../groupes.util';

@Component({
  selector: 'app-group-elo-chart',
  standalone: true,
  templateUrl: './group-elo-chart.component.html',
})
export class GroupEloChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly groupInput = signal<Group | null>(null);
  @Input() set group(value: Group | null) {
    this.groupInput.set(value);
  }

  private readonly matchesInput = signal<HistoryEntry[]>([]);
  @Input() set groupMatches(value: HistoryEntry[] | undefined) {
    this.matchesInput.set(value ?? []);
  }

  private chart: Chart | null = null;
  private viewReady = false;

  readonly chartData = computed<EloPoint[]>(() => {
    const group = this.groupInput();
    if (!group) return [];
    return computeGroupEloHistory(group, this.matchesInput());
  });

  constructor() {
    effect(() => {
      const data = this.chartData();
      if (this.viewReady) this.renderChart(data);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart(this.chartData());
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(chartData: EloPoint[]): void {
    if (!this.canvasRef) return;
    this.chart?.destroy();

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.map((d) => d.x),
        datasets: [
          {
            label: 'Moyenne Elo du Groupe',
            data: chartData.map((d) => d.y),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 3,
            pointBackgroundColor: '#fbbf24',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#f59e0b',
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
