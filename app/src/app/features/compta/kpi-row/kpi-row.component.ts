import { Component, Input } from '@angular/core';
import { fmt } from '../../../core/utils/format.util';
import { FinanceSummary } from '../compta-finance.model';

@Component({
  selector: 'app-kpi-row',
  standalone: true,
  templateUrl: './kpi-row.component.html',
})
export class KpiRowComponent {
  @Input({ required: true }) summary!: FinanceSummary;

  readonly fmt = fmt;

  bankrollText(): string {
    const total = this.summary.totalPnL;
    return (total >= 0 ? '+' : '') + fmt(total) + '$';
  }

  bankrollClass(): string {
    const total = this.summary.totalPnL;
    return 'text-3xl font-black ' + (total > 0 ? 'text-emerald-400' : total < 0 ? 'text-red-500' : 'text-white');
  }
}
