import { Player } from '../../core/models';
import { TournamentGroup } from './tournament.model';

export function tournamentTeamLabel(group: TournamentGroup, players: Player[]): string {
  const members = group.participants
    .map((id) => players.find((player) => player.id === id)?.name ?? id)
    .join(' & ');
  return group.name?.trim() ? `${group.name.trim()} - ${members}` : members || 'Équipe';
}
