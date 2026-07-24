import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Player } from '../../../core/models';
import { rankByElo } from '../../../core/utils/groups.util';

@Component({
  selector: 'app-leaderboard-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './leaderboard-card.component.html',
})
export class LeaderboardCardComponent {
  private readonly playersInput = signal<Player[]>([]);
  @Input() set players(value: Player[] | undefined) {
    this.playersInput.set(value ?? []);
  }
  @Input() isAdmin = false;

  @Output() editPlayer = new EventEmitter<Player>();

  readonly ranked = computed(() =>
    rankByElo(this.playersInput()).map((p) => ({ ...p, roundedElo: Math.round(p.elo) })),
  );

  rankColor(rank: number): string {
    if (rank === 1) return 'text-yellow-400 font-bold';
    if (rank === 2) return 'text-slate-300 font-bold';
    if (rank === 3) return 'text-amber-600 font-bold';
    return 'text-slate-400';
  }

  winrate(p: Player): number {
    const total = p.wins + p.losses;
    return total === 0 ? 0 : Math.round((p.wins / total) * 100);
  }
}
