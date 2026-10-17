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
    const validGroups = groups.map((group) => ({
      ...group,
      participants: [...group.participants],
    }));
    const tournament: Tournament = {
      id: Date.now().toString(),
      name,
      groups: validGroups,
      bracket: this.generateBracket(validGroups),
      createdAt: Date.now(),
    };

    const updated = [...this.tournaments(), tournament];
    this.tournaments.set(updated);
    this.saveTournaments();
    this.currentTournament.set(tournament);

    return tournament;
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

    const createMatch = (round: string, p1?: string, p2?: string, isBye = false): TournamentMatch => ({
      id: matchId(),
      round,
      participant1: p1,
      participant2: p2,
      ...(isBye ? { isBye, winner: p1 } : {}),
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
      currentRoundMatches.push(createMatch(rounds[0], qualifier, undefined, true));
    }

    for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
      const nextRoundMatches: TournamentMatch[] = [];
      for (let i = 0; i < currentRoundMatches.length; i += 2) {
        const match1 = currentRoundMatches[i];
        const match2 = currentRoundMatches[i + 1];
        const nextMatch = createMatch(rounds[roundIndex], match1.winner, match2?.winner);
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

    const updatedTournament = { ...tournament, bracket };
    const updated = this.tournaments().map((t) => (t.id === tournament.id ? updatedTournament : t));
    this.tournaments.set(updated);
    this.saveTournaments();
    this.currentTournament.set(updatedTournament);
  }
}
