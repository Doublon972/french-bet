import { Component, Input, computed, signal } from '@angular/core';
import { HistoryEntry } from '../../../core/models';
import { RankedPlayer, Streak, computeStreak } from '../classement.util';
import { EloChartComponent } from '../elo-chart/elo-chart.component';
import { PlayerMatchHistoryComponent } from '../player-match-history/player-match-history.component';

@Component({
  selector: 'app-player-detail-panel',
  standalone: true,
  imports: [EloChartComponent, PlayerMatchHistoryComponent],
  templateUrl: './player-detail-panel.component.html',
})
export class PlayerDetailPanelComponent {
  private readonly playerInput = signal<RankedPlayer | null>(null);
  @Input() set player(value: RankedPlayer | null | undefined) {
    this.playerInput.set(value ?? null);
  }

  private readonly totalPlayerCountInput = signal(0);
  @Input() set totalPlayerCount(value: number | undefined) {
    this.totalPlayerCountInput.set(value ?? 0);
  }

  private readonly reversedMatchesInput = signal<HistoryEntry[]>([]);
  @Input() set reversedMatches(value: HistoryEntry[] | undefined) {
    this.reversedMatchesInput.set(value ?? []);
  }

  readonly currentPlayer = this.playerInput.asReadonly();
  readonly currentReversedMatches = this.reversedMatchesInput.asReadonly();

  readonly initials = computed(() => (this.playerInput()?.name ?? '').substring(0, 2).toUpperCase());

  readonly rankText = computed(() => {
    const p = this.playerInput();
    if (!p) return '';
    return `${p.rank}${p.rank === 1 ? 'er' : 'ème'} sur ${this.totalPlayerCountInput()}`;
  });

  readonly totalGames = computed(() => {
    const p = this.playerInput();
    return p ? p.wins + p.losses : 0;
  });

  readonly winrate = computed(() => {
    const p = this.playerInput();
    if (!p) return 0;
    const total = p.wins + p.losses;
    return total === 0 ? 0 : Math.round((p.wins / total) * 100);
  });

  readonly streak = computed<Streak>(() => {
    const p = this.playerInput();
    if (!p) return { count: 0, status: null };
    return computeStreak(this.reversedMatchesInput(), p.id, p.name);
  });

  round(value: number): number {
    return Math.round(value);
  }
}
