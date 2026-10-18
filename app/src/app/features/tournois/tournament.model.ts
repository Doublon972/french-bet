export interface TournamentGroup {
  id: string;
  name?: string;
  participants: string[];
}

export interface TournamentMatch {
  id: string;
  round: string;
  participant1?: string | null;
  participant2?: string | null;
  winner?: string;
  isBye?: boolean;
  children?: TournamentMatch[];
}

export interface Tournament {
  id: string;
  name: string;
  groups: TournamentGroup[];
  bracket: TournamentMatch | null;
  createdAt: number;
  participantsPerGroup: number;
  isDraft: boolean;
}
