import { Injectable, Signal, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Database, push, ref, remove, set, update } from 'firebase/database';
import { FIREBASE_DATABASE } from '../../core/firebase.providers';
import { Tournament, TournamentGroup, TournamentMatch } from './tournament.model';
import { listValue$ } from '../../core/utils/rtdb.util';

@Injectable({
  providedIn: 'root',
})
export class TournamentService {
  private readonly db: Database = inject(FIREBASE_DATABASE);
  readonly tournaments: Signal<Tournament[] | undefined> = toSignal(
    listValue$<Omit<Tournament, 'id'>>(this.db, 'tournaments')
  );
  readonly currentTournament = signal<Tournament | null>(null);

  async createTournament(name: string, participantsPerGroup: number): Promise<Tournament> {
    const tournament: Tournament = {
      id: Date.now().toString(),
      name,
      groups: [],
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

  async updateTournamentGroups(tournamentId: string, groups: TournamentGroup[]): Promise<void> {
    const validGroups = groups.map((group) => ({
      ...group,
      participants: [...group.participants],
    }));
    await set(ref(this.db, `tournaments/${tournamentId}/groups`), validGroups);
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
    const tournament = this.tournaments()?.find((candidate) => candidate.id === tournamentId);
    if (!tournament || !tournament.bracket) return;

    let changed = false;
    const updateMatch = (match: TournamentMatch): TournamentMatch => {
      if (match.id === matchId) {
        if (match.isBye || match.winner || ![match.participant1, match.participant2].includes(winner)) {
          return match;
        }
        changed = true;
        return { ...match, winner };
      }
      if (match.children) {
        const children = match.children.map(updateMatch);
        if (children.some((child, index) => child !== match.children![index])) {
          return {
            ...match,
            children,
            participant1: children[0]?.winner,
            participant2: children[1]?.winner,
          };
        }
      }
      return match;
    };

    const bracket = updateMatch(tournament.bracket);
    if (!changed) return;

    const { id, ...tournamentData } = { ...tournament, bracket };
    await update(ref(this.db, `tournaments/${id}`), tournamentData);
    if (this.currentTournament()?.id === tournament.id) {
      this.currentTournament.set({ ...tournament, bracket });
    }
  }
}
