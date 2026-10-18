import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { Player } from '../../../core/models';
import { TournamentGroup, TournamentMatch } from '../tournament.model';
import { tournamentTeamLabel } from '../tournament.util';

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
export class TournamentBracketComponent implements OnChanges {
  @Input() match: TournamentMatch | null = null;
  @Input() groups: TournamentGroup[] = [];
  @Input() players: Player[] = [];
  @Input() selectedMatchId: string | null = null;
  @Output() matchSelect = new EventEmitter<TournamentMatch>();

  rounds: Round[] = [];

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.match) {
      this.rounds = this.extractRounds(this.match);
    } else {
      this.rounds = [];
    }
  }

  onSelectMatch(match: TournamentMatch): void {
    if (this.canLaunchMatch(match)) {
      this.matchSelect.emit(match);
    }
  }

  canLaunchMatch(match: TournamentMatch): boolean {
    // Un match peut être lancé si les deux participants sont définis
    // et le match n'a pas déjà de gagnant
    return !!match.participant1 && !!match.participant2 && !match.winner;
  }

  isMatchDisabled(match: TournamentMatch): boolean {
    return !this.canLaunchMatch(match);
  }

  participantLabel(id: string): string {
    const group = this.groups.find((candidate) => candidate.id === id);
    return group ? tournamentTeamLabel(group, this.players) : id;
  }

  private extractRounds(match: TournamentMatch, depth = 0): Round[] {
    const rounds: Round[] = [];

    const processMatch = (m: TournamentMatch, currentDepth: number): void => {
      if (!rounds[currentDepth]) {
        rounds[currentDepth] = { name: m.round, matches: [] };
      }
      if (!m.isBye) rounds[currentDepth].matches.push(m);

      if (m.children && m.children.length > 0) {
        m.children.forEach((child) => {
          if (child) processMatch(child, currentDepth + 1);
        });
      }
    };

    processMatch(match, depth);
    return rounds.reverse();
  }
}
