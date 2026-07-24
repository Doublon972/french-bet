import { HistoryEntry, Player } from '../../core/models';

/** Un joueur classé, avec son rang dense calculé par `rankByElo`. */
export type RankedPlayer = Player & { rank: number };

/**
 * Détermine si le joueur appartient à l'équipe A d'un match : priorité aux `teamA_ids` (identifiants
 * fiables), sinon repli sur une recherche du nom dans la chaîne `teamA_names` (matchs legacy sans ids).
 */
export function isInTeamA(match: HistoryEntry, playerId: string, playerName: string): boolean {
  if (match.teamA_ids) return match.teamA_ids.includes(playerId);
  return !!match.teamA_names && match.teamA_names.includes(playerName);
}

/** Même logique que `isInTeamA`, pour l'équipe B. */
export function isInTeamB(match: HistoryEntry, playerId: string, playerName: string): boolean {
  if (match.teamB_ids) return match.teamB_ids.includes(playerId);
  return !!match.teamB_names && match.teamB_names.includes(playerName);
}

/** Un match "appartient" au joueur s'il figure dans l'une ou l'autre équipe. */
export function isPlayerInMatch(match: HistoryEntry, playerId: string, playerName: string): boolean {
  return isInTeamA(match, playerId, playerName) || isInTeamB(match, playerId, playerName);
}

/** Le joueur a-t-il gagné ce match ? Suppose qu'il appartient bien au match (voir `isPlayerInMatch`). */
export function isMatchWin(match: HistoryEntry, playerId: string, playerName: string): boolean {
  const teamA = isInTeamA(match, playerId, playerName);
  return (teamA && match.winner === 'A') || (!teamA && match.winner === 'B');
}

export interface Streak {
  count: number;
  status: 'W' | 'L' | null;
}

/**
 * Calcule la série en cours à partir des matchs du joueur triés du plus récent au plus ancien :
 * compte les résultats identiques consécutifs depuis le match le plus récent.
 */
export function computeStreak(reversedMatches: HistoryEntry[], playerId: string, playerName: string): Streak {
  let count = 0;
  let status: 'W' | 'L' | null = null;

  for (const match of reversedMatches) {
    const currentStatus: 'W' | 'L' = isMatchWin(match, playerId, playerName) ? 'W' : 'L';
    if (status === null) status = currentStatus;
    if (currentStatus === status) count++;
    else break;
  }

  return { count, status };
}

export interface EloChartPoint {
  x: string;
  y: number;
}

/**
 * Reconstruit l'historique de l'Elo du joueur à partir de sa valeur actuelle : en partant des matchs
 * du plus récent au plus ancien, on "annule" chaque delta pour retrouver l'Elo avant ce match, puis on
 * inverse la liste pour obtenir une série chronologique (du plus ancien au plus récent).
 */
export function buildEloChartData(player: Player, reversedMatches: HistoryEntry[]): EloChartPoint[] {
  let currentElo = player.elo;
  const points: EloChartPoint[] = [{ x: 'Actuel', y: Math.round(currentElo) }];

  for (const match of reversedMatches) {
    const isWin = isMatchWin(match, player.id, player.name);
    const delta = match.eloChanges?.[player.id] ?? (isWin ? 16 : -16);
    currentElo -= delta;

    const dateObj = new Date(match.timestamp);
    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
    points.push({ x: dateStr, y: Math.round(currentElo) });
  }

  return points.reverse();
}
