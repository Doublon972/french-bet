import { Injectable, signal } from '@angular/core';
import { Tournament, TournamentGroup, TournamentMatch } from './tournament.model';

@Injectable({
  providedIn: 'root',
})
export class TournamentService {
  private readonly STORAGE_KEY = 'tournaments';
  readonly tournaments = signal<Tournament[]>([]);
  readonly currentTournament = signal<Tournament | null>(null);

  constructor() {
    this.loadTournaments();
  }

  private loadTournaments(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.tournaments.set(JSON.parse(stored));
      } catch (e) {
        console.error('Erreur lors du chargement des tournois', e);
      }
    }
  }

  private saveTournaments(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.tournaments()));
  }

  createTournament(name: string, groups: TournamentGroup[]): Tournament {
    const tournament: Tournament = {
      id: Date.now().toString(),
      name,
      groups,
      bracket: this.generateBracket(groups),
      createdAt: Date.now(),
    };

    const updated = [...this.tournaments(), tournament];
    this.tournaments.set(updated);
    this.saveTournaments();
    this.currentTournament.set(tournament);

    return tournament;
  }

  private generateBracket(groups: TournamentGroup[]): TournamentMatch | null {
    const teams = groups.filter((group) => group.participants.length > 0).map((group) => group.id);

    if (teams.length < 2) return null;

    return this.buildBracket(this.shuffleArray(teams));
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
    const matchId = () => Math.random().toString(36).substr(2, 9);
    const createMatch = (round: string): TournamentMatch => ({ id: matchId(), round });
    const power = 2 ** Math.ceil(Math.log2(participants.length));
    const byeCount = power - participants.length;
    const firstRoundMatchCount = participants.length - power / 2;
    const firstRoundParticipants = participants.slice(byeCount);
    const directQualifiers = participants.slice(0, byeCount);
    const entries: Array<TournamentMatch | string> = [];

    for (let i = 0; i < firstRoundMatchCount; i++) {
      const match = createMatch(rounds[0]);
      match.participant1 = firstRoundParticipants[i * 2];
      match.participant2 = firstRoundParticipants[i * 2 + 1];
      entries.push(match);
      if (directQualifiers[i]) entries.push(directQualifiers[i]);
    }

    for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
      const nextRoundEntries: TournamentMatch[] = [];
      for (let i = 0; i < entries.length; i += 2) {
        const match = createMatch(rounds[roundIndex]);
        const left = entries[i];
        const right = entries[i + 1];
        const children: [TournamentMatch | null, TournamentMatch | null] = [null, null];

        if (typeof left === 'string') match.participant1 = left;
        else children[0] = left;
        if (typeof right === 'string') match.participant2 = right;
        else children[1] = right;

        match.children = children;
        nextRoundEntries.push(match);
      }
      entries.splice(0, entries.length, ...nextRoundEntries);
    }

    const bracket = entries[0];
    if (!bracket || typeof bracket === 'string') {
      throw new Error('Impossible de générer le tableau du tournoi.');
    }
    return bracket;
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
      return rounds.slice(rounds.length - totalRounds);
    }

    return rounds;
  }

  selectTournament(tournament: Tournament): void {
    this.currentTournament.set(tournament);
  }

  deleteTournament(tournamentId: string): void {
    const updated = this.tournaments().filter((t) => t.id !== tournamentId);
    this.tournaments.set(updated);
    this.saveTournaments();
    if (this.currentTournament()?.id === tournamentId) {
      this.currentTournament.set(null);
    }
  }

  updateMatchWinner(matchId: string, winner: string): void {
    const tournament = this.currentTournament();
    if (!tournament || !tournament.bracket) return;

    const findMatch = (match: TournamentMatch): TournamentMatch | null => {
      if (match.id === matchId) {
        return match;
      }
      if (match.children) {
        for (const child of match.children) {
          if (child) {
            const found = findMatch(child);
            if (found) return found;
          }
        }
      }
      return null;
    };

    const selectedMatch = findMatch(tournament.bracket);
    if (
      !selectedMatch ||
      !selectedMatch.participant1 ||
      !selectedMatch.participant2 ||
      (winner !== selectedMatch.participant1 && winner !== selectedMatch.participant2)
    ) {
      return;
    }
    selectedMatch.winner = winner;

    const refreshParticipants = (match: TournamentMatch): string | undefined => {
      if (match.children) {
        if (match.children[0]) match.participant1 = refreshParticipants(match.children[0]);
        if (match.children[1]) match.participant2 = refreshParticipants(match.children[1]);
      }
      if (match.winner !== match.participant1 && match.winner !== match.participant2) {
        match.winner = undefined;
      }
      return match.winner;
    };
    refreshParticipants(tournament.bracket);

    const updated = this.tournaments().map((t) => (t.id === tournament.id ? tournament : t));
    this.tournaments.set(updated);
    this.currentTournament.set({ ...tournament });
    this.saveTournaments();
  }
}
