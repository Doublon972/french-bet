import { Group } from '../models/group.model';
import { Player } from '../models/player.model';

/**
 * Un joueur appartient à un groupe si son nom suit la convention "Groupe - Joueur".
 * Les joueurs sans " - " dans leur nom ne sont rattachés à aucun groupe.
 */
export function splitGroupName(playerName: string): { groupName: string | null; displayName: string } {
  const parts = playerName.split(' - ');
  if (parts.length > 1) {
    return { groupName: parts[0].trim(), displayName: playerName };
  }
  return { groupName: null, displayName: playerName };
}

export function stripGroupPrefix(playerName: string, groupName: string): string {
  return playerName.replace(groupName + ' - ', '');
}

/** Dérive les groupes à partir de la liste des joueurs (aucune entité Firebase dédiée). */
export function buildGroups(players: Player[]): Group[] {
  const groupMap = new Map<string, Group>();

  for (const p of players) {
    const { groupName } = splitGroupName(p.name);
    if (!groupName) continue;

    let group = groupMap.get(groupName);
    if (!group) {
      group = { id: groupName, name: groupName, members: [], totalElo: 0, avgElo: 0 };
      groupMap.set(groupName, group);
    }
    group.members.push(p);
    group.totalElo += p.elo;
  }

  return Array.from(groupMap.values()).map((g) => ({ ...g, avgElo: g.totalElo / g.members.length }));
}

/** Classement dense : le rang n'augmente que si l'Elo moyen (arrondi) baisse par rapport au précédent. */
export function rankByAvgElo<T extends { avgElo: number }>(items: T[]): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => b.avgElo - a.avgElo);
  let currentRank = 1;
  let previousElo: number | null = null;

  return sorted.map((item) => {
    const roundedElo = Math.round(item.avgElo);
    if (previousElo !== null && roundedElo < previousElo) currentRank++;
    previousElo = roundedElo;
    return { ...item, rank: currentRank };
  });
}

/** Même règle de classement dense, appliquée directement à l'Elo d'un joueur. */
export function rankByElo<T extends { elo: number }>(items: T[]): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => b.elo - a.elo);
  let currentRank = 1;
  let previousElo: number | null = null;

  return sorted.map((item) => {
    const roundedElo = Math.round(item.elo);
    if (previousElo !== null && roundedElo < previousElo) currentRank++;
    previousElo = roundedElo;
    return { ...item, rank: currentRank };
  });
}
