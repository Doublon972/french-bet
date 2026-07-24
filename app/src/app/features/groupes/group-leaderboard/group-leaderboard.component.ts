import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { RankedGroup } from '../groupes.util';

@Component({
  selector: 'app-group-leaderboard',
  standalone: true,
  templateUrl: './group-leaderboard.component.html',
})
export class GroupLeaderboardComponent {
  private readonly groupsInput = signal<RankedGroup[]>([]);
  @Input() set groups(value: RankedGroup[] | undefined) {
    this.groupsInput.set(value ?? []);
  }
  @Input() selectedGroupId: string | null = null;

  @Output() select = new EventEmitter<string>();

  readonly searchTerm = signal('');

  readonly filtered = computed(() =>
    this.groupsInput()
      .filter((g) => g.name.toLowerCase().includes(this.searchTerm()))
      .map((g) => ({ ...g, roundedAvgElo: Math.round(g.avgElo) })),
  );

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value.toLowerCase());
  }

  rankColor(rank: number): string {
    if (rank === 1) return 'text-yellow-400 font-black';
    if (rank === 2) return 'text-slate-300 font-bold';
    if (rank === 3) return 'text-amber-600 font-bold';
    return 'text-slate-400';
  }
}
