export type TeamSide = 'A' | 'B';

export interface Bet {
  user: string;
  team: TeamSide;
  amount: number;
  potentialWin: number;
  paid: boolean;
}
