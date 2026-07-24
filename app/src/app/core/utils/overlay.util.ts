import { HistoryEntry } from '../models/match.model';
import { Player } from '../models/player.model';
import { rankByElo } from './groups.util';

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

/**
 * Pour chaque joueur impliqué dans `entry`, calcule son rang au classement juste avant et
 * juste après ce match (en "annulant" le delta Elo appliqué via `eloChanges`, puis en reclassant
 * l'intégralité du roster dans les deux états).
 */
export function computeRankMovements(players: Player[], entry: HistoryEntry): RankMovement[] {
  const eloChanges = entry.eloChanges ?? {};
  const involvedIds = new Set(involvedPlayerIds(entry));
  if (involvedIds.size === 0) return [];

  const beforePlayers = players.map((p) =>
    eloChanges[p.id] !== undefined ? { ...p, elo: p.elo - eloChanges[p.id] } : p,
  );

  const rankedBefore = rankByElo(beforePlayers);
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

export interface EloRecord {
  playerId: string;
  name: string;
  elo: number;
  rank: number;
}

/**
 * Détermine, parmi les joueurs impliqués dans `entry`, ceux qui viennent d'atteindre leur
 * meilleur Elo personnel de tous les temps (en reconstituant leur historique via `eloChanges`,
 * comme le graphique Elo de la page Classement). Un joueur à son tout premier match n'est
 * jamais considéré en "record" (rien à battre).
 */
export function computeEloRecords(players: Player[], allMatchesAscending: HistoryEntry[], entry: HistoryEntry): EloRecord[] {
  const eloChanges = entry.eloChanges ?? {};
  const involvedIds = involvedPlayerIds(entry);
  if (involvedIds.length === 0) return [];

  const rankedAfter = rankByElo(players);
  const priorMatches = [...allMatchesAscending].filter((m) => m.id !== entry.id && m.timestamp < entry.timestamp).reverse();

  const records: EloRecord[] = [];
  for (const id of involvedIds) {
    const player = players.find((p) => p.id === id);
    const delta = eloChanges[id];
    if (!player || delta === undefined) continue;

    const beforeElo = player.elo - delta;
    let historicalMax = beforeElo;
    let hasPriorMatch = false;
    let runningElo = beforeElo;

    for (const m of priorMatches) {
      const isTeamA = (m.teamA_ids ?? []).includes(id);
      const isTeamB = (m.teamB_ids ?? []).includes(id);
      if (!isTeamA && !isTeamB) continue;
      hasPriorMatch = true;
      const d = m.eloChanges?.[id] ?? 0;
      runningElo -= d;
      historicalMax = Math.max(historicalMax, runningElo);
    }

    if (hasPriorMatch && player.elo > historicalMax) {
      const rank = rankedAfter.find((p) => p.id === id)?.rank ?? 0;
      records.push({ playerId: id, name: player.name, elo: Math.round(player.elo), rank });
    }
  }
  return records;
}
