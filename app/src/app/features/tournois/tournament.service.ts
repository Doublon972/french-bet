import { Injectable, Signal, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Database, ref, remove, runTransaction, set, update } from 'firebase/database';
import { map } from 'rxjs';
import { FIREBASE_DATABASE } from '../../core/firebase.providers';
import { Tournament, TournamentGroup, TournamentMatch } from './tournament.model';
import { listValue$ } from '../../core/utils/rtdb.util';

@Injectable({
  providedIn: 'root',
})
export class TournamentService {
  private readonly db: Database = inject(FIREBASE_DATABASE);
  readonly tournaments: Signal<Tournament[] | undefined> = toSignal(
    listValue$<Omit<Tournament, 'id'>>(this.db, 'tournaments').pipe(
      map((tournaments) =>
        tournaments.map((tournament) => ({
          ...tournament,
          groups: this.normalizeGroups(tournament.groups),
        })),
      ),
    ),
  );
  readonly currentTournament = signal<Tournament | null>(null);

  async createTournament(
    name: string,
    participantsPerGroup: number,
    groups: TournamentGroup[],
  ): Promise<Tournament> {
    const tournament: Tournament = {
      id: Date.now().toString(),
      name,
      groups: groups.map((group) => ({ ...group, participants: [...group.participants] })),
      bracket: null,
      createdAt: Date.now(),
      participantsPerGroup,
      isDraft: true,
    };

    const { id, ...tournamentData } = tournament;
    await set(ref(this.db, `tournaments/${id}`), tournamentData);
    this.currentTournament.set(tournament);

    return tournament;
  }

  async finalizeTournament(tournamentId: string, groups: TournamentGroup[]): Promise<void> {
    const tournament = this.tournaments()?.find((t) => t.id === tournamentId)
      ?? (this.currentTournament()?.id === tournamentId ? this.currentTournament()! : null);
    if (!tournament) throw new Error(`Tournament ${tournamentId} was not found.`);

    const validGroups = groups.map((group) => ({
      ...group,
      participants: [...group.participants],
    }));

    const bracket = this.generateBracket(validGroups);
    await update(ref(this.db, `tournaments/${tournamentId}`), {
      groups: validGroups,
      bracket,
      isDraft: false,
    });
    if (this.currentTournament()?.id === tournament.id) {
      this.currentTournament.set({ ...tournament, groups: validGroups, bracket, isDraft: false });
    }
  }

  async regenerateBracket(tournamentId: string, groups: TournamentGroup[]): Promise<void> {
    const tournament = this.tournaments()?.find((t) => t.id === tournamentId)
      ?? (this.currentTournament()?.id === tournamentId ? this.currentTournament()! : null);
    if (!tournament) throw new Error(`Tournament ${tournamentId} was not found.`);

    const validGroups = groups.map((group) => ({
      ...group,
      participants: [...group.participants],
    }));

    const bracket = this.generateBracket(validGroups);
    await update(ref(this.db, `tournaments/${tournamentId}`), {
      groups: validGroups,
      bracket,
    });
    if (this.currentTournament()?.id === tournament.id) {
      this.currentTournament.set({ ...tournament, groups: validGroups, bracket });
    }
  }

  async swapGroups(tournamentId: string, groupIndex1: number, groupIndex2: number): Promise<void> {
    const tournament = this.tournaments()?.find((t) => t.id === tournamentId)
      ?? (this.currentTournament()?.id === tournamentId ? this.currentTournament()! : null);
    if (!tournament) throw new Error(`Tournament ${tournamentId} was not found.`);

    const groups = [...tournament.groups];
    [groups[groupIndex1], groups[groupIndex2]] = [groups[groupIndex2], groups[groupIndex1]];

    const bracket = this.generateBracket(groups);
    await update(ref(this.db, `tournaments/${tournamentId}`), {
      groups,
      bracket,
    });
    if (this.currentTournament()?.id === tournament.id) {
      this.currentTournament.set({ ...tournament, groups, bracket });
    }
  }

  hasCompletedMatches(bracket: TournamentMatch | null): boolean {
    if (!bracket) return false;
    const checkMatch = (match: TournamentMatch): boolean => {
      if (match.winner) return true;
      if (match.children) {
        return match.children.some(checkMatch);
      }
      return false;
    };
    return checkMatch(bracket);
  }

  async addTournamentGroups(tournamentId: string, groupsToAdd: TournamentGroup[]): Promise<void> {
    const groupsRef = ref(this.db, `tournaments/${tournamentId}/groups`);
    const result = await runTransaction(groupsRef, (current) => {
      const groups = this.normalizeGroups(current);
      const existingIds = new Set(groups.map((group) => group.id));
      return [
        ...groups,
        ...groupsToAdd
          .filter((group) => !existingIds.has(group.id))
          .map((group) => ({ ...group, participants: [...group.participants] })),
      ];
    });
    if (!result.committed) throw new Error(`Could not add groups to tournament ${tournamentId}.`);
    this.updateCurrentTournamentGroups(tournamentId, this.normalizeGroups(result.snapshot.val()));
  }

  async removeTournamentGroup(tournamentId: string, groupId: string): Promise<void> {
    const groupsRef = ref(this.db, `tournaments/${tournamentId}/groups`);
    const result = await runTransaction(groupsRef, (current) =>
      this.normalizeGroups(current).filter((group) => group.id !== groupId),
    );
    if (!result.committed) throw new Error(`Could not remove group ${groupId} from tournament ${tournamentId}.`);
    this.updateCurrentTournamentGroups(tournamentId, this.normalizeGroups(result.snapshot.val()));
  }

  async updateTournamentGroupName(tournamentId: string, groupId: string, name: string): Promise<void> {
    const groupIndex = this.getGroupIndex(tournamentId, groupId);
    await update(ref(this.db), { [`tournaments/${tournamentId}/groups/${groupIndex}/name`]: name });
  }

  async updateTournamentParticipant(
    tournamentId: string,
    groupId: string,
    participantIndex: number,
    participantId: string,
  ): Promise<void> {
    const groupIndex = this.getGroupIndex(tournamentId, groupId);
    await update(ref(this.db), {
      [`tournaments/${tournamentId}/groups/${groupIndex}/participants/${participantIndex}`]: participantId,
    });
  }

  private getGroupIndex(tournamentId: string, groupId: string): number {
    const latest = this.tournaments()?.find((candidate) => candidate.id === tournamentId);
    const current = this.currentTournament()?.id === tournamentId ? this.currentTournament() : null;
    const latestIndex = latest?.groups.findIndex((group) => group.id === groupId) ?? -1;
    const currentIndex = current?.groups.findIndex((group) => group.id === groupId) ?? -1;
    const groupIndex = latestIndex >= 0 ? latestIndex : currentIndex;
    if (groupIndex < 0) throw new Error(`Group ${groupId} was not found in tournament ${tournamentId}.`);
    return groupIndex;
  }

  private updateCurrentTournamentGroups(tournamentId: string, groups: TournamentGroup[]): void {
    const tournament = this.currentTournament();
    if (tournament?.id === tournamentId) this.currentTournament.set({ ...tournament, groups });
  }

  private normalizeGroups(groups: unknown): TournamentGroup[] {
    const entries = Array.isArray(groups)
      ? groups
      : groups && typeof groups === 'object'
        ? Object.values(groups)
        : [];
    return entries.filter((group): group is TournamentGroup =>
      !!group &&
      typeof group === 'object' &&
      typeof (group as TournamentGroup).id === 'string' &&
      Array.isArray((group as TournamentGroup).participants),
    );
  }

  private generateBracket(groups: TournamentGroup[]): TournamentMatch | null {
    const allParticipants = groups.map((group) => group.id);

    if (allParticipants.length < 2) return null;

    return this.buildBracket(this.shuffleArray(allParticipants));
  }

  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private buildBracket(participants: string[]): TournamentMatch {
    const rounds = this.calculateRounds(participants.length);
    const matchId = () => Math.random().toString(36).slice(2, 11);

    const createMatch = (round: string, p1?: string | null, p2?: string | null, isBye = false): TournamentMatch => ({
      id: matchId(),
      round,
      participant1: p1 ?? null,
      participant2: p2 ?? null,
      ...(isBye ? { isBye, winner: p1 ?? undefined } : {}),
    });

    let power = 1;
    while (power < participants.length) {
      power *= 2;
    }

    const byes = power - participants.length;
    const firstRoundParticipants = participants.slice(byes);
    let currentRoundMatches: TournamentMatch[] = [];
    for (let i = 0; i < firstRoundParticipants.length; i += 2) {
      currentRoundMatches.push(createMatch(rounds[0], firstRoundParticipants[i], firstRoundParticipants[i + 1]));
    }
    for (const qualifier of participants.slice(0, byes)) {
      currentRoundMatches.push(createMatch(rounds[0], qualifier, null, true));
    }

    for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
      const nextRoundMatches: TournamentMatch[] = [];
      for (let i = 0; i < currentRoundMatches.length; i += 2) {
        const match1 = currentRoundMatches[i];
        const match2 = currentRoundMatches[i + 1];
        const nextMatch = createMatch(rounds[roundIndex], match1.winner ?? null, match2?.winner ?? null);
        nextMatch.children = match2 ? [match1, match2] : [match1];
        nextRoundMatches.push(nextMatch);
      }
      currentRoundMatches = nextRoundMatches;
    }

    return currentRoundMatches[0];
  }

  private calculateRounds(participantCount: number): string[] {
    const rounds: string[] = [];
    let power = 1;

    while (power < participantCount) {
      power *= 2;
    }

    const totalRounds = Math.log2(power);

    if (totalRounds >= 6) rounds.push('32èmes');
    if (totalRounds >= 5) rounds.push('16èmes');
    if (totalRounds >= 4) rounds.push('8èmes');
    if (totalRounds >= 3) rounds.push('Quarts');
    if (totalRounds >= 2) rounds.push('Demies');
    if (totalRounds >= 1) rounds.push('Finale');

    // Si on a moins de participants que la puissance de 2 supérieure
    // on ajuste les noms des tours
    if (rounds.length > totalRounds) {
      rounds.splice(0, rounds.length - totalRounds);
    }

    const openingMatches = participantCount - power / 2;
    if (rounds.length > 1 && openingMatches > 0 && openingMatches < power / 4) {
      rounds[0] = 'Barrages';
    }
    return rounds;
  }

  selectTournament(tournament: Tournament): void {
    this.currentTournament.set(tournament);
  }

  async deleteTournament(tournamentId: string): Promise<void> {
    await remove(ref(this.db, `tournaments/${tournamentId}`));
    if (this.currentTournament()?.id === tournamentId) {
      this.currentTournament.set(null);
    }
  }

  async updateMatchWinner(tournamentId: string, matchId: string, winner: string): Promise<void> {
    const bracketRef = ref(this.db, `tournaments/${tournamentId}/bracket`);
    const result = await runTransaction(bracketRef, (current) => {
      if (!this.isTournamentMatch(current)) return;
      let found = false;
      let changed = false;

      const updateMatch = (match: TournamentMatch): TournamentMatch => {
        if (match.id === matchId) {
          found = true;
          if (
            match.isBye ||
            match.winner ||
            ![match.participant1, match.participant2].includes(winner)
          ) {
            return match;
          }
          changed = true;
          return { ...match, winner };
        }

        if (!match.children) return match;
        const children = match.children.map(updateMatch);
        if (!children.some((child, index) => child !== match.children![index])) return match;

        return {
          ...match,
          children,
          participant1: children[0]?.winner ?? null,
          participant2: children[1]?.winner ?? null,
        };
      };

      const bracket = updateMatch(current);
      return found && changed ? bracket : undefined;
    });

    if (!result.committed) {
      const currentBracket = result.snapshot.val();
      if (!this.isTournamentMatch(currentBracket)) {
        throw new Error(`Tournament ${tournamentId} has no valid bracket.`);
      }
      const findMatch = (match: TournamentMatch | null): TournamentMatch | null => {
        if (!match) return null;
        if (match.id === matchId) return match;
        for (const child of match.children ?? []) {
          const found = findMatch(child);
          if (found) return found;
        }
        return null;
      };
      if (findMatch(currentBracket)?.winner === winner) return;
      throw new Error(`Could not record winner ${winner} for tournament match ${matchId}.`);
    }

    const tournament = this.currentTournament();
    const bracket = result.snapshot.val();
    if (tournament?.id === tournamentId && this.isTournamentMatch(bracket)) {
      this.currentTournament.set({ ...tournament, bracket });
    }
  }

  private isTournamentMatch(value: unknown): value is TournamentMatch {
    return (
      !!value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'round' in value &&
      typeof value.round === 'string'
    );
  }
}
