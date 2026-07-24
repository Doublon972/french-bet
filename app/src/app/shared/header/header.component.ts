import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

export interface NavLink {
  label: string;
  path: string;
  variant?: 'accent' | 'plain';
  showBackIcon?: boolean;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private readonly authService = inject(AuthService);

  @Input() subtitle = '';
  @Input() navLinks: NavLink[] = [];
  @Input() showAdminBar = false;
  @Input() logoLarge = false;

  // `pnlAmount` doit être un signal pour que `pnlDisplay` (computed) se recalcule quand la
  // valeur change — une simple propriété @Input n'est jamais suivie par computed().
  private readonly pnlAmountInput = signal<number | null>(null);
  @Input() set pnlAmount(value: number | null | undefined) {
    this.pnlAmountInput.set(value ?? null);
  }

  @Output() openSettings = new EventEmitter<void>();
  @Output() resetData = new EventEmitter<void>();

  readonly isAdmin = this.authService.isAdmin;

  readonly loginModalOpen = signal(false);
  readonly loginError = signal(false);
  loginEmail = '';
  loginPassword = '';

  readonly pnlDisplay = computed(() => {
    const amount = this.pnlAmountInput();
    if (amount === null) return { text: '0$', className: 'text-slate-400 font-black' };
    if (amount > 0) return { text: `+${amount.toFixed(0)}$`, className: 'text-emerald-400 font-black' };
    if (amount < 0) return { text: `${amount.toFixed(0)}$`, className: 'text-red-500 font-black' };
    return { text: '0$', className: 'text-slate-400 font-black' };
  });

  openLoginModal(): void {
    this.loginError.set(false);
    this.loginEmail = '';
    this.loginPassword = '';
    this.loginModalOpen.set(true);
  }

  closeLoginModal(): void {
    this.loginModalOpen.set(false);
  }

  attemptLogin(): void {
    this.authService
      .login(this.loginEmail, this.loginPassword)
      .then(() => {
        this.loginError.set(false);
        this.closeLoginModal();
      })
      .catch((error) => {
        console.error("Erreur d'authentification", error);
        this.loginError.set(true);
      });
  }

  logout(): void {
    this.authService.logout().catch((error) => console.error('Erreur lors de la déconnexion', error));
  }
}
