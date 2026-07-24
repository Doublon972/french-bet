import { Player } from './player.model';

export interface Group {
  id: string;
  name: string;
  members: Player[];
  totalElo: number;
  avgElo: number;
}
