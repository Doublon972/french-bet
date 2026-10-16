import { Bet, TeamSide } from './bet.model';
import { Player } from './player.model';

export interface ActiveMatch {
  teamA: Player[];
  teamB: Player[];
  oddsA: string;
  oddsB: string;
  probA: number;
  probB: number;
  bets?: Record<string, Bet>;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  teamA_names: string;
  teamB_names: string;
  teamA_ids?: string[];
  teamB_ids?: string[];
  oddsA: string;
  oddsB: string;
  winner: TeamSide;
  bets?: Record<string, Bet>;
  eloChanges?: Record<string, number>;
}

export interface Session {
  id: string;
  timestamp: number;
  pnl: number;
  matches?: Record<string, Omit<HistoryEntry, 'id'>>;
}
