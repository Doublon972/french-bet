import { Component, Input } from '@angular/core';
import { TournamentMatch } from '../tournament.model';

interface Round {
  name: string;
  matches: TournamentMatch[];
}

@Component({
  selector: 'app-tournament-bracket',
  standalone: true,
  templateUrl: './tournament-bracket.component.html',
  styleUrls: ['./tournament-bracket.component.css'],
})
export class TournamentBracketComponent {
  @Input() match: TournamentMatch | null = null;

  rounds: Round[] = [];

  ngOnInit(): void {
    if (this.match) {
      this.rounds = this.extractRounds(this.match);
    }
  }

  private extractRounds(match: TournamentMatch, depth = 0): Round[] {
    const rounds: Round[] = [];

    const processMatch = (m: TournamentMatch, currentDepth: number): void => {
      if (!rounds[currentDepth]) {
        rounds[currentDepth] = { name: m.round, matches: [] };
      }
      rounds[currentDepth].matches.push(m);

      if (m.children && m.children.length > 0) {
        m.children.forEach((child) => processMatch(child, currentDepth + 1));
      }
    };

    processMatch(match, depth);
    return rounds;
  }
}
