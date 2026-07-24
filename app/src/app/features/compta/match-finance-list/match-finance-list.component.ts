import { Component, Input } from '@angular/core';
import { fmt, formatDateFull, fmtSigned } from '../../../core/utils/format.util';
import { FinanceSummary, MatchFinance } from '../compta-finance.model';

@Component({
  selector: 'app-match-finance-list',
  standalone: true,
  templateUrl: './match-finance-list.component.html',
})
export class MatchFinanceListComponent {
  @Input({ required: true }) summary!: FinanceSummary;

  readonly fmt = fmt;
  readonly fmtSigned = fmtSigned;
  readonly formatDateFull = formatDateFull;

  borderClass(m: MatchFinance): string {
    if (m.pnl === 0) return 'border-slate-700/50';
    return m.pnl > 0 ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-red-500/30 bg-red-900/10';
  }

  pnlClass(m: MatchFinance): string {
    if (m.pnl === 0) return 'text-slate-400';
    return m.pnl > 0 ? 'text-emerald-400' : 'text-red-400';
  }

  teamAClass(m: MatchFinance): string {
    return m.winner === 'A' ? 'text-blue-400 font-bold' : 'text-slate-500';
  }

  teamBClass(m: MatchFinance): string {
    return m.winner === 'B' ? 'text-red-400 font-bold' : 'text-slate-500';
  }
}
