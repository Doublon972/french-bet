import { Component, Input } from '@angular/core';
import { fmt, formatDateFull } from '../../../core/utils/format.util';
import { FinanceSummary } from '../compta-finance.model';

@Component({
  selector: 'app-unpaid-bets-list',
  standalone: true,
  templateUrl: './unpaid-bets-list.component.html',
})
export class UnpaidBetsListComponent {
  @Input({ required: true }) summary!: FinanceSummary;

  readonly fmt = fmt;
  readonly formatDateFull = formatDateFull;
}
