import { Component, computed, effect, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HeaderComponent, NavLink } from '../../shared/header/header.component';
import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { buildFinanceSummary } from './compta-finance.model';
import { KpiRowComponent } from './kpi-row/kpi-row.component';
import { BestWorstMatchComponent } from './best-worst-match/best-worst-match.component';
import { BankrollChartComponent } from './bankroll-chart/bankroll-chart.component';
import { MatchFinanceListComponent } from './match-finance-list/match-finance-list.component';
import { UnpaidBetsListComponent } from './unpaid-bets-list/unpaid-bets-list.component';

const NAV_LINKS: NavLink[] = [
  { label: '👤 Classement', path: '/classement' },
  { label: '🚩 Groupes', path: '/groupes' },
  { label: 'Retour à la Draft', path: '/', variant: 'plain', showBackIcon: true },
];

/** Délai avant redirection vers l'accueil pour un utilisateur non-admin, identique à l'original. */
const ACCESS_DENIED_REDIRECT_DELAY_MS = 1800;

@Component({
  selector: 'app-compta-page',
  standalone: true,
  imports: [
    RouterLink,
    HeaderComponent,
    KpiRowComponent,
    BestWorstMatchComponent,
    BankrollChartComponent,
    MatchFinanceListComponent,
    UnpaidBetsListComponent,
  ],
  templateUrl: './compta-page.component.html',
})
export class ComptaPageComponent {
  private readonly authService = inject(AuthService);
  private readonly historyService = inject(HistoryService);
  private readonly router = inject(Router);

  readonly navLinks = NAV_LINKS;

  readonly authReady = this.authService.authReady;
  readonly isAdmin = this.authService.isAdmin;

  readonly financeSummary = computed(() => buildFinanceSummary(this.historyService.allMatches()));

  constructor() {
    // Sécurité d'accès : redirige vers l'accueil si l'utilisateur n'est pas admin,
    // une fois le tout premier callback d'auth reçu (comme le onAuthStateChanged original).
    effect((onCleanup) => {
      if (!this.authReady() || this.isAdmin()) return;
      const timeoutId = setTimeout(() => this.router.navigate(['/']), ACCESS_DENIED_REDIRECT_DELAY_MS);
      onCleanup(() => clearTimeout(timeoutId));
    });
  }
}
