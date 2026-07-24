import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { HistoryEntry, Session } from '../../../core/models';

@Component({
  selector: 'app-session-detail-modal',
  standalone: true,
  templateUrl: './session-detail-modal.component.html',
})
export class SessionDetailModalComponent {
  // `session` doit être un signal pour que `titleDate`/`matches` (computed) se recalculent si
  // la session change pendant que la modale est ouverte.
  private readonly sessionInput = signal<Session | null>(null);
  @Input({ required: true }) set session(value: Session) {
    this.sessionInput.set(value);
  }
  get session(): Session {
    return this.sessionInput()!;
  }
  @Input() isAdmin = false;

  @Output() close = new EventEmitter<void>();
  @Output() selectMatch = new EventEmitter<HistoryEntry>();
  @Output() deleteSession = new EventEmitter<void>();

  readonly titleDate = computed(() => {
    const session = this.sessionInput();
    if (!session) return '';
    return new Date(session.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  });

  readonly matches = computed(() => {
    const raw = this.sessionInput()?.matches ?? {};
    const list: HistoryEntry[] = Object.keys(raw).map((id) => ({ id, ...raw[id] }));
    return list.sort((a, b) => b.timestamp - a.timestamp);
  });

  confirmDelete(): void {
    if (
      confirm(
        "⚠️ ATTENTION : Voulez-vous vraiment supprimer intégralement cette session ?\n\nTous les matchs seront annulés, et les points Elo ainsi que les victoires/défaites des joueurs seront restaurés à leur état précédent.",
      )
    ) {
      this.deleteSession.emit();
    }
  }
}
