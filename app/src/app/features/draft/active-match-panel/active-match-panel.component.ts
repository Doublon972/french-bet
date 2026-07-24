import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActiveMatch } from '../../../core/models';
import { TeamSide } from '../../../core/models/bet.model';

@Component({
  selector: 'app-active-match-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './active-match-panel.component.html',
})
export class ActiveMatchPanelComponent {
  // `match` doit être un signal : sinon les `computed()` qui en dépendent (bets/potA/potB) ne se
  // recalculent jamais quand Firebase pousse une mise à jour (ex: nouveau pari ajouté).
  private readonly matchInput = signal<ActiveMatch | null>(null);
  @Input({ required: true }) set match(value: ActiveMatch) {
    this.matchInput.set(value);
  }
  get match(): ActiveMatch {
    return this.matchInput()!;
  }
  @Input() isAdmin = false;

  @Output() placeBet = new EventEmitter<{ team: TeamSide; user: string; amount: number }>();
  @Output() cancelBet = new EventEmitter<string>();
  @Output() resolveMatch = new EventEmitter<TeamSide>();
  @Output() cancelMatch = new EventEmitter<void>();

  betNameA = '';
  betAmountA: number | null = null;
  betNameB = '';
  betAmountB: number | null = null;

  readonly bets = computed(() => Object.entries(this.matchInput()?.bets ?? {}));

  readonly potA = computed(() =>
    this.bets()
      .filter(([, b]) => b.team === 'A')
      .reduce((sum, [, b]) => sum + b.amount, 0),
  );
  readonly potB = computed(() =>
    this.bets()
      .filter(([, b]) => b.team === 'B')
      .reduce((sum, [, b]) => sum + b.amount, 0),
  );

  submitBet(team: TeamSide): void {
    const amount = team === 'A' ? this.betAmountA : this.betAmountB;
    if (amount === null || isNaN(amount) || amount <= 0) {
      alert('Montant invalide.');
      return;
    }
    const user = (team === 'A' ? this.betNameA : this.betNameB).trim();
    this.placeBet.emit({ team, user, amount });
    if (team === 'A') {
      this.betNameA = '';
      this.betAmountA = null;
    } else {
      this.betNameB = '';
      this.betAmountB = null;
    }
  }

  confirmResolve(winner: TeamSide): void {
    const teamLabel = winner === 'A' ? 'Bleue' : 'Rouge';
    if (confirm(`Confirmer la victoire de l'équipe ${teamLabel} ?`)) {
      this.resolveMatch.emit(winner);
    }
  }

  confirmCancelBet(betId: string): void {
    if (confirm('Annuler ce pari ?')) this.cancelBet.emit(betId);
  }
}
