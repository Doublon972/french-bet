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
    const allParticipants: string[] = [];
    groups.forEach((group) => {
      group.participants.forEach((participant) => {
        allParticipants.push(`${group.name ? group.name + ' - ' : ''}${participant}`);
      });
    });

    if (allParticipants.length < 2) return null;

    // Mélanger les participants aléatoirement
    const shuffled = this.shuffleArray([...allParticipants]);

    return this.buildBracket(shuffled);
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

    const createMatch = (round: string, p1?: string, p2?: string): TournamentMatch => ({
      id: matchId(),
      round,
      participant1: p1,
      participant2: p2,
    });

    // Mélanger les participants
    const shuffled = this.shuffleArray([...participants]);

    // Créer les matchs du premier tour
    let currentRoundMatches: TournamentMatch[] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      const p1 = shuffled[i];
      const p2 = shuffled[i + 1];
      currentRoundMatches.push(createMatch(rounds[0], p1, p2));
    }

    // Construire les tours suivants
    for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
      const nextRoundMatches: TournamentMatch[] = [];
      for (let i = 0; i < currentRoundMatches.length; i += 2) {
        const match1 = currentRoundMatches[i];
        const match2 = currentRoundMatches[i + 1];
        const newMatch = createMatch(rounds[roundIndex]);
        newMatch.children = [match1, match2];
        nextRoundMatches.push(newMatch);
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

    const updateMatch = (match: TournamentMatch): boolean => {
      if (match.id === matchId) {
        match.winner = winner;
        return true;
      }
      if (match.children) {
        for (const child of match.children) {
          if (updateMatch(child)) {
            // Mettre à jour le participant parent si les deux enfants ont un gagnant
            if (match.children[0].winner && match.children[1].winner) {
              const winnerIndex = Math.random() < 0.5 ? 0 : 1;
              match.participant1 = match.children[0].winner;
              match.participant2 = match.children[1].winner;
            }
            return true;
          }
        }
      }
      return false;
    };

    updateMatch(tournament.bracket);

    // Mettre à jour dans la liste des tournois
    const updated = this.tournaments().map((t) => (t.id === tournament.id ? tournament : t));
    this.tournaments.set(updated);
    this.saveTournaments();
  }
}
