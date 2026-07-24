import { Component, Input } from '@angular/core';
import { formatDateFull, fmtSigned } from '../../../core/utils/format.util';
import { FinanceSummary } from '../compta-finance.model';

@Component({
  selector: 'app-best-worst-match',
  standalone: true,
  templateUrl: './best-worst-match.component.html',
})
export class BestWorstMatchComponent {
  @Input({ required: true }) summary!: FinanceSummary;

  readonly formatDateFull = formatDateFull;
  readonly fmtSigned = fmtSigned;
}
