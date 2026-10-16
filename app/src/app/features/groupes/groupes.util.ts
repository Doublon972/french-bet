import { Group, HistoryEntry, Player } from '../../core/models';
import { stripGroupPrefix } from '../../core/utils/groups.util';

export type RankedGroup = Group & { rank: number };
export type TeamSideKey = 'A' | 'B';

/** Vrai si CE membre précis se trouve dans le camp indiqué (ids en priorité, noms en repli). */
export function memberInSide(member: Player, match: HistoryEntry, side: TeamSideKey): boolean {
  const ids = side === 'A' ? match.teamA_ids : match.teamB_ids;
  const names = side === 'A' ? match.teamA_names : match.teamB_names;
  if (ids) return ids.includes(member.id);
  return !!names && names.includes(member.name);
}

/** Vrai si AU MOINS UN membre du groupe se trouve dans le camp indiqué. */
export function groupInSide(group: Group, match: HistoryEntry, side: TeamSideKey): boolean {
  return group.members.some((member) => memberInSide(member, match, side));
}

/** Un match "implique" le groupe si l'un de ses membres est présent dans l'un des deux camps. */
export function matchInvolvesGroup(group: Group, match: HistoryEntry): boolean {
  return groupInSide(group, match, 'A') || groupInSide(group, match, 'B');
}

export interface GroupStats {
  realTotalGames: number;
  winrate: number;
}

/**
 * Stats "propres" du groupe : une "Guerre Civile" (le groupe des deux côtés) compte dans le
 * total de matchs mais est exclue du calcul du winrate pour ne pas le fausser.
 */
export function computeGroupStats(group: Group, groupMatches: HistoryEntry[]): GroupStats {
  let realGroupWins = 0;
  let validMatchesForWinrate = 0;

  for (const m of groupMatches) {
    const groupInA = groupInSide(group, m, 'A');
    const groupInB = groupInSide(group, m, 'B');

    if (groupInA && !groupInB) {
      validMatchesForWinrate++;
      if (m.winner === 'A') realGroupWins++;
    } else if (!groupInA && groupInB) {
      validMatchesForWinrate++;
      if (m.winner === 'B') realGroupWins++;
    }
    // groupInA && groupInB -> Guerre Civile -> ignoré du winrate.
  }

  const winrate = validMatchesForWinrate === 0 ? 0 : Math.round((realGroupWins / validMatchesForWinrate) * 100);
  return { realTotalGames: groupMatches.length, winrate };
}

export interface EloPoint {
  x: string;
  y: number;
}

/**
 * Reconstitue l'historique de la moyenne Elo du groupe en "remontant le temps" match par match
 * (du plus récent au plus ancien), puis inverse pour un affichage chronologique croissant.
 */
export function computeGroupEloHistory(group: Group, groupMatches: HistoryEntry[]): EloPoint[] {
  const currentElos: Record<string, number> = {};
  for (const m of group.members) currentElos[m.id] = m.elo;

  const chartData: EloPoint[] = [{ x: 'Actuel', y: Math.round(group.avgElo) }];
  const reversedMatches = [...groupMatches].reverse();

  for (const m of reversedMatches) {
    let matchAlteredGroupElo = false;

    for (const member of group.members) {
      const isTeamA = memberInSide(member, m, 'A');
      const isTeamB = memberInSide(member, m, 'B');
      if (!isTeamA && !isTeamB) continue;

      const isWin = (isTeamA && m.winner === 'A') || (isTeamB && m.winner === 'B');
      const delta = m.eloChanges?.[member.id] ?? (isWin ? 16 : -16);
      currentElos[member.id] -= delta;
      matchAlteredGroupElo = true;
    }

    if (matchAlteredGroupElo) {
      const totalEloNow = Object.values(currentElos).reduce((sum, val) => sum + val, 0);
      const avgEloNow = totalEloNow / group.members.length;
      const dateObj = new Date(m.timestamp);
      const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      chartData.push({ x: dateStr, y: Math.round(avgEloNow) });
    }
  }

  return chartData.reverse();
}

/**
 * Remplace, dans une chaîne "team" (ex: teamA_names), le nom complet de chaque membre du groupe
 * par un badge ambre affichant son nom sans le préfixe de groupe.
 */
export function formatTeamForGroup(teamStr: string | undefined, group: Group): string {
  if (!teamStr) return '';
  let formatted = teamStr;
  for (const member of group.members) {
    const badge = `<span class="inline-block bg-amber-500/30 text-white font-black px-1.5 py-0.5 rounded-md border border-amber-500/50 shadow-sm mx-0.5">${stripGroupPrefix(member.name, group.name)}</span>`;
    formatted = formatted.replace(member.name, badge);
  }
  return formatted;
}
