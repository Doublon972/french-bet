import { Player } from '../../core/models';
import { TournamentGroup } from './tournament.model';

export function tournamentTeamLabel(group: TournamentGroup, players: Player[]): string {
  return group.participants
    .map((id) => players.find((player) => player.id === id)?.name ?? id)
    .join(' & ') || 'Équipe';
}
