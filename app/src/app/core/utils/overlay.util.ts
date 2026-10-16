import { HistoryEntry } from '../models/match.model';
import { Player } from '../models/player.model';
import { Group } from '../models/group.model';
import { buildGroups, rankByAvgElo, rankByElo, splitGroupName } from './groups.util';

export interface RankMovement {
  playerId: string;
  name: string;
  beforeElo: number;
  afterElo: number;
  beforeRank: number;
  afterRank: number;
}

/** Ids des joueurs impliqués dans un match (uniquement via ids — les matchs créés par l'app actuelle en ont toujours). */
export function involvedPlayerIds(entry: HistoryEntry): string[] {
  return [...(entry.teamA_ids ?? []), ...(entry.teamB_ids ?? [])];
}

/** Reconstitue le roster tel qu'il était juste avant `entry`, en annulant les deltas `eloChanges`. */
function reconstructBeforePlayers(players: Player[], entry: HistoryEntry): Player[] {
  const eloChanges = entry.eloChanges ?? {};
  return players.map((p) => (eloChanges[p.id] !== undefined ? { ...p, elo: p.elo - eloChanges[p.id] } : p));
}

/**
 * Pour chaque joueur impliqué dans `entry`, calcule son rang au classement juste avant et
 * juste après ce match (en "annulant" le delta Elo appliqué via `eloChanges`, puis en reclassant
 * l'intégralité du roster dans les deux états).
 */
export function computeRankMovements(players: Player[], entry: HistoryEntry): RankMovement[] {
  const involvedIds = new Set(involvedPlayerIds(entry));
  if (involvedIds.size === 0) return [];

  const rankedBefore = rankByElo(reconstructBeforePlayers(players, entry));
  const rankedAfter = rankByElo(players);

  const movements: RankMovement[] = [];
  for (const id of involvedIds) {
    const before = rankedBefore.find((p) => p.id === id);
    const after = rankedAfter.find((p) => p.id === id);
    if (!before || !after) continue;
    movements.push({
      playerId: id,
      name: after.name,
      beforeElo: Math.round(before.elo),
      afterElo: Math.round(after.elo),
      beforeRank: before.rank,
      afterRank: after.rank,
    });
  }
  return movements;
}

export interface PlayerPodiumEntry {
  playerId: string;
  name: string;
  elo: number;
  afterRank: number;
}

/**
 * Parmi les joueurs de l'équipe GAGNANTE, ceux qui viennent d'entrer dans le top 3 (podium) —
 * c'est-à-dire qui n'y étaient pas avant ce match (`beforeRank > 3`) et y sont maintenant
 * (`afterRank <= 3`, égalités comprises grâce au classement dense). Un joueur déjà dans le top 3
 * qui y reste, ou qui recule sans jamais y avoir été, ne déclenche rien.
 */
export function computePlayerPodiumEntries(players: Player[], entry: HistoryEntry): PlayerPodiumEntry[] {
  const winningIds = new Set(entry.winner === 'A' ? entry.teamA_ids ?? [] : entry.teamB_ids ?? []);
  if (winningIds.size === 0) return [];

  const movements = computeRankMovements(players, entry);

  return movements
    .filter((m) => winningIds.has(m.playerId) && m.beforeRank > 3 && m.afterRank <= 3)
    .map((m) => ({ playerId: m.playerId, name: m.name, elo: m.afterElo, afterRank: m.afterRank }));
}

export interface GroupPodiumEntry {
  groupId: string;
  groupName: string;
  avgElo: number;
  afterRank: number;
}

/**
 * Même logique que `computePlayerPodiumEntries`, mais au niveau des groupes : un groupe entre
 * dans le top 3 du classement des groupes (par Elo moyen) grâce à ce match. Ne compte que les
 * groupes entièrement du côté gagnant (une "Guerre Civile", où le groupe est présent des deux
 * côtés, n'a pas de camp gagnant clair et est ignorée — même convention que la page Groupes).
 */
export function computeGroupPodiumEntries(players: Player[], entry: HistoryEntry): GroupPodiumEntry[] {
  const involvedIds = new Set(involvedPlayerIds(entry));
  if (involvedIds.size === 0) return [];

  const winningIds = new Set(entry.winner === 'A' ? entry.teamA_ids ?? [] : entry.teamB_ids ?? []);
  const losingIds = new Set(entry.winner === 'A' ? entry.teamB_ids ?? [] : entry.teamA_ids ?? []);

  const involvedGroupNames = new Set<string>();
  for (const p of players) {
    if (!involvedIds.has(p.id)) continue;
    const { groupName } = splitGroupName(p.name);
    if (groupName) involvedGroupNames.add(groupName);
  }
  if (involvedGroupNames.size === 0) return [];

  const rankedBefore = rankByAvgElo(buildGroups(reconstructBeforePlayers(players, entry)));
  const rankedAfter = rankByAvgElo(buildGroups(players));

  const findGroup = (ranked: (Group & { rank: number })[], name: string) => ranked.find((g) => g.name === name);

  const entries: GroupPodiumEntry[] = [];
  for (const groupName of involvedGroupNames) {
    const after = findGroup(rankedAfter, groupName);
    const before = findGroup(rankedBefore, groupName);
    if (!after || !before) continue;

    const hasWinner = after.members.some((m) => winningIds.has(m.id));
    const hasLoser = after.members.some((m) => losingIds.has(m.id));
    if (!hasWinner || hasLoser) continue; // pas gagnant, ou "Guerre Civile" (présent des deux côtés)

    if (before.rank > 3 && after.rank <= 3) {
      entries.push({
        groupId: after.id,
        groupName: after.name,
        avgElo: Math.round(after.avgElo),
        afterRank: after.rank,
      });
    }
  }
  return entries;
}
