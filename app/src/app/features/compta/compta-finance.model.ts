import { Bet, HistoryEntry } from '../../core/models';
import { formatDateShort } from '../../core/utils/format.util';

export interface MatchFinance extends HistoryEntry {
  pnl: number;
  wagered: number;
  betsCount: number;
}

export interface UnpaidBet extends Bet {
  matchTimestamp: number;
  matchTeams: string;
}

export interface ChartPoint {
  x: string;
  y: number;
}

export interface FinanceSummary {
  totalPnL: number;
  totalWagered: number;
  totalBets: number;
  matchesCount: number;
  avgBet: number;
  unpaidLiability: number;
  unpaidBets: UnpaidBet[];
  matchFinance: MatchFinance[];
  /** `matchFinance` du plus récent au plus ancien, pour l'affichage de la liste. */
  matchFinanceReversed: MatchFinance[];
  chartPoints: ChartPoint[];
  best: MatchFinance | null;
  worst: MatchFinance | null;
}

/**
 * Port exact de la fonction `render()` de compta.html (lignes 232-309) :
 * un seul passage sur `allMatches` (déjà triés par timestamp croissant) pour
 * accumuler le P&L, la mise totale, la dette de paiement, la série du graphique
 * et l'historique financier par match.
 */
export function buildFinanceSummary(allMatches: HistoryEntry[]): FinanceSummary {
  let totalPnL = 0;
  let totalWagered = 0;
  let totalBets = 0;
  let unpaidLiability = 0;
  const unpaidBets: UnpaidBet[] = [];
  let cumulative = 0;
  const chartPoints: ChartPoint[] = [];
  const matchFinance: MatchFinance[] = [];

  for (const m of allMatches) {
    let matchPnL = 0;
    let matchWagered = 0;
    let matchBetsCount = 0;

    if (m.bets) {
      for (const bet of Object.values(m.bets)) {
        matchWagered += bet.amount || 0;
        matchBetsCount++;

        if (bet.team === m.winner) {
          matchPnL -= (bet.potentialWin || 0) - (bet.amount || 0);
          // paid === false uniquement : les paris sans ce champ (ancien format)
          // ont tous été payés avant l'ajout de cette fonctionnalité.
          if (bet.paid === false) {
            unpaidLiability += bet.potentialWin || 0;
            unpaidBets.push({
              ...bet,
              matchTimestamp: m.timestamp,
              matchTeams: bet.team === 'A' ? m.teamA_names : m.teamB_names,
            });
          }
        } else {
          matchPnL += bet.amount || 0;
        }
      }
    }

    totalPnL += matchPnL;
    totalWagered += matchWagered;
    totalBets += matchBetsCount;
    cumulative += matchPnL;

    chartPoints.push({ x: formatDateShort(m.timestamp), y: Math.round(cumulative) });
    matchFinance.push({ ...m, pnl: matchPnL, wagered: matchWagered, betsCount: matchBetsCount });
  }

  unpaidBets.sort((a, b) => b.matchTimestamp - a.matchTimestamp);

  const matchesWithBets = matchFinance.filter((m) => m.betsCount > 0);
  let best: MatchFinance | null = null;
  let worst: MatchFinance | null = null;
  if (matchesWithBets.length > 0) {
    best = matchesWithBets.reduce((a, b) => (b.pnl > a.pnl ? b : a));
    worst = matchesWithBets.reduce((a, b) => (b.pnl < a.pnl ? b : a));
  }

  return {
    totalPnL,
    totalWagered,
    totalBets,
    matchesCount: allMatches.length,
    avgBet: totalBets > 0 ? totalWagered / totalBets : 0,
    unpaidLiability,
    unpaidBets,
    matchFinance,
    matchFinanceReversed: [...matchFinance].reverse(),
    chartPoints,
    best,
    worst,
  };
}
