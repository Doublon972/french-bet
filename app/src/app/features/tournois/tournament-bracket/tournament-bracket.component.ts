import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { Player } from '../../../core/models';
import { TournamentGroup, TournamentMatch } from '../tournament.model';
import { tournamentTeamLabel } from '../tournament.util';

interface Round {
  name: string;
  matches: MatchLayout[];
}

interface MatchLayout {
  match: TournamentMatch;
  rowStart: number;
  rowSpan: number;
  hasTwoChildren: boolean;
  hasVisibleParent: boolean;
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
  leafMatchCount = 0;
  bracketHeight = 600;

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

  private extractRounds(root: TournamentMatch): Round[] {
    const rounds = new Map<number, Round>();
    let nextLeafIndex = 0;

    const visit = (
      match: TournamentMatch,
      depth: number,
      hasVisibleParent = false,
    ): { start: number; count: number } | null => {
      if (match.isBye) return null;

      const children = match.children?.filter((child) => !!child) ?? [];
      const childLayouts = children
        .map((child) => visit(child, depth + 1, true))
        .filter((layout): layout is { start: number; count: number } => layout !== null);
      const start = childLayouts[0]?.start ?? nextLeafIndex++;
      const leafCount = childLayouts.reduce((sum, child) => sum + child.count, 0) || 1;

      const round = rounds.get(depth) ?? { name: match.round, matches: [] };
      round.matches.push({
        match,
        rowStart: start * 2 + 1,
        rowSpan: leafCount * 2,
        hasTwoChildren: childLayouts.length === 2,
        hasVisibleParent,
      });
      rounds.set(depth, round);

      return { start, count: leafCount };
    };

    visit(root, 0);
    this.leafMatchCount = nextLeafIndex;
    this.bracketHeight = Math.max(680, this.leafMatchCount * 170);
    return [...rounds.entries()]
      .sort(([depthA], [depthB]) => depthB - depthA)
      .map(([, round]) => round);
  }
}
