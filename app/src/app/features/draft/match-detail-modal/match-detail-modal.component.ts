import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { HistoryEntry } from '../../../core/models';

@Component({
  selector: 'app-match-detail-modal',
  standalone: true,
  templateUrl: './match-detail-modal.component.html',
})
export class MatchDetailModalComponent {
  // `match` doit être un signal : sinon `sortedBets` (computed) ne se recalcule jamais quand
  // Firebase pousse une mise à jour (ex: bascule "payé"/"à payer").
  private readonly matchInput = signal<HistoryEntry | null>(null);
  @Input({ required: true }) set match(value: HistoryEntry) {
    this.matchInput.set(value);
  }
  get match(): HistoryEntry {
    return this.matchInput()!;
  }
  @Input() isAdmin = false;
  /** Le bouton "payer"/"annuler le match" ne s'affiche que pour un match de la session EN COURS (pas archivé). */
  @Input() isLiveMatch = false;

  @Output() close = new EventEmitter<void>();
  @Output() togglePaid = new EventEmitter<{ betId: string; currentStatus: boolean }>();
  @Output() cancelMatch = new EventEmitter<void>();

  readonly sortedBets = computed(() => {
    const match = this.matchInput();
    if (!match) return [];
    const entries = Object.entries(match.bets ?? {});
    entries.sort((a, b) => {
      const aWin = a[1].team === match.winner ? 1 : 0;
      const bWin = b[1].team === match.winner ? 1 : 0;
      return bWin - aWin;
    });
    return entries;
  });

  isWinner(betId: string): boolean {
    const match = this.matchInput();
    const bet = match?.bets?.[betId];
    return !!bet && !!match && bet.team === match.winner;
  }

  confirmCancel(): void {
    if (
      confirm(
        '⚠️ ATTENTION : Voulez-vous vraiment annuler ce match ? Les points Elo et les victoires/défaites des joueurs seront restaurés.',
      )
    ) {
      this.cancelMatch.emit();
    }
  }
}
