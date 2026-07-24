import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { Session } from '../../../core/models';

@Component({
  selector: 'app-sessions-card',
  standalone: true,
  templateUrl: './sessions-card.component.html',
})
export class SessionsCardComponent {
  private readonly sessionsInput = signal<Session[]>([]);
  @Input() set sessions(value: Session[] | undefined) {
    this.sessionsInput.set(value ?? []);
  }
  @Input() isAdmin = false;

  @Output() selectSession = new EventEmitter<Session>();

  readonly rows = computed(() =>
    this.sessionsInput().map((s) => {
      const pnl = s.pnl || 0;
      return {
        session: s,
        dateStr: new Date(s.timestamp).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        pnl: Math.round(pnl),
        pnlColor: pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-500' : 'text-slate-400',
        sign: pnl > 0 ? '+' : '',
        nbMatches: s.matches ? Object.keys(s.matches).length : 0,
      };
    }),
  );
}
