import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Player } from '../../../core/models';
import { RankedPlayer } from '../classement.util';

@Component({
  selector: 'app-player-leaderboard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './player-leaderboard.component.html',
})
export class PlayerLeaderboardComponent {
  private readonly playersInput = signal<RankedPlayer[]>([]);
  @Input() set players(value: RankedPlayer[] | undefined) {
    this.playersInput.set(value ?? []);
  }

  private readonly selectedPlayerIdInput = signal<string | null>(null);
  @Input() set selectedPlayerId(value: string | null | undefined) {
    this.selectedPlayerIdInput.set(value ?? null);
  }

  @Output() select = new EventEmitter<string>();

  readonly searchTerm = signal('');

  readonly filteredPlayers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.playersInput().filter((p) => p.name.toLowerCase().includes(term));
  });

  isSelected(p: RankedPlayer): boolean {
    return p.id === this.selectedPlayerIdInput();
  }

  rankColor(rank: number): string {
    if (rank === 1) return 'text-yellow-400 font-black';
    if (rank === 2) return 'text-slate-300 font-bold';
    if (rank === 3) return 'text-amber-600 font-bold';
    return 'text-slate-400';
  }

  totalGames(p: Player): number {
    return p.wins + p.losses;
  }

  winrate(p: Player): number {
    const total = p.wins + p.losses;
    return total === 0 ? 0 : Math.round((p.wins / total) * 100);
  }

  round(value: number): number {
    return Math.round(value);
  }
}
