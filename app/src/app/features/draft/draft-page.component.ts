import { Component, computed, inject, signal } from '@angular/core';
import { HeaderComponent, NavLink } from '../../shared/header/header.component';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { DraftService } from '../../core/services/draft.service';
import { HistoryService } from '../../core/services/history.service';
import { MatchService } from '../../core/services/match.service';
import { PlayersService } from '../../core/services/players.service';
import { SettingsService } from '../../core/services/settings.service';
import { AppSettings, HistoryEntry, Player } from '../../core/models';
import { TeamSide } from '../../core/models/bet.model';
import { RosterFormComponent } from './roster-form/roster-form.component';
import { LeaderboardCardComponent } from './leaderboard-card/leaderboard-card.component';
import { HistoryCardComponent } from './history-card/history-card.component';
import { SessionsCardComponent } from './sessions-card/sessions-card.component';
import { DraftBoardComponent } from './draft-board/draft-board.component';
import { ActiveMatchPanelComponent } from './active-match-panel/active-match-panel.component';
import { MatchDetailModalComponent } from './match-detail-modal/match-detail-modal.component';
import { SessionDetailModalComponent } from './session-detail-modal/session-detail-modal.component';
import { SettingsModalComponent } from './settings-modal/settings-modal.component';

const NAV_LINKS: NavLink[] = [];

@Component({
  selector: 'app-draft-page',
  standalone: true,
  imports: [
    HeaderComponent,
    RosterFormComponent,
    LeaderboardCardComponent,
    HistoryCardComponent,
    SessionsCardComponent,
    DraftBoardComponent,
    ActiveMatchPanelComponent,
    MatchDetailModalComponent,
    SessionDetailModalComponent,
    SettingsModalComponent,
  ],
  templateUrl: './draft-page.component.html',
})
export class DraftPageComponent {
  private readonly authService = inject(AuthService);
  private readonly playersService = inject(PlayersService);
  private readonly draftService = inject(DraftService);
  private readonly matchService = inject(MatchService);
  private readonly historyService = inject(HistoryService);
  private readonly settingsService = inject(SettingsService);
  private readonly adminService = inject(AdminService);

  readonly navLinks = NAV_LINKS;

  readonly isAdmin = this.authService.isAdmin;
  readonly players = computed<Player[]>(() => this.playersService.players() ?? []);
  readonly draft = this.draftService.draft;
  readonly activeMatch = this.matchService.activeMatch;
  readonly history = this.historyService.history;
  readonly sessions = this.historyService.sessions;
  readonly settings = this.settingsService.settings;

  readonly totalPnL = computed(() => {
    let total = 0;
    for (const match of this.history()) {
      if (!match.bets) continue;
      for (const bet of Object.values(match.bets)) {
        if (bet.team === match.winner) total -= bet.potentialWin - bet.amount;
        else total += bet.amount;
      }
    }
    for (const session of this.sessions()) total += session.pnl || 0;
    return total;
  });

  readonly settingsModalOpen = signal(false);

  readonly selectedMatchId = signal<string | null>(null);
  readonly selectedMatch = computed<HistoryEntry | null>(() => {
    const id = this.selectedMatchId();
    if (!id) return null;
    return this.historyService.allMatches().find((m) => m.id === id) ?? null;
  });
  readonly isSelectedMatchLive = computed(
    () => !!this.selectedMatchId() && this.history().some((m) => m.id === this.selectedMatchId()),
  );

  readonly selectedSessionId = signal<string | null>(null);
  readonly selectedSession = computed(() => {
    const id = this.selectedSessionId();
    if (!id) return null;
    return this.sessions().find((s) => s.id === id) ?? null;
  });

  addPlayer(name: string): void {
    this.playersService.addPlayer(name, this.settings().baseElo);
  }

  editPlayer(player: Player): void {
    const newName = prompt('Nouveau pseudo :', player.name);
    if (newName !== null && newName.trim() !== '' && newName.trim() !== player.name) {
      this.playersService.renamePlayer(player.id, newName.trim());
    }
  }

  onDraftChange(change: { teamA: string[]; teamB: string[] }): void {
    if (!this.isAdmin()) return;
    this.draftService.setDraft(change.teamA, change.teamB);
  }

  createMatch(): void {
    if (!this.isAdmin()) return;
    const { teamA, teamB } = this.draft();
    if (teamA.length === 0 || teamB.length === 0) {
      alert('Il faut au moins un joueur dans chaque équipe !');
      return;
    }
    const players = this.players();
    const teamAPlayers = players.filter((p) => teamA.includes(p.id));
    const teamBPlayers = players.filter((p) => teamB.includes(p.id));
    this.matchService.createMatch(teamAPlayers, teamBPlayers, this.settings());
  }

  cancelMatch(): void {
    this.matchService.cancelMatch();
  }

  placeBet(payload: { team: TeamSide; user: string; amount: number }): void {
    const match = this.activeMatch();
    if (!match) return;
    this.matchService.placeBet(match, payload.team, payload.user, payload.amount);
  }

  cancelActiveBet(betId: string): void {
    this.matchService.cancelActiveBet(betId);
  }

  resolveMatch(winner: TeamSide): void {
    const match = this.activeMatch();
    if (!match) return;
    this.matchService.resolveMatch(match, winner, this.settings());
  }

  closeSession(): void {
    if (this.history().length === 0) {
      alert('Aucun match valide dans l’historique en cours à clôturer.');
      return;
    }
    if (!confirm('Voulez-vous clôturer cette session ? L’historique sera archivé et remis à zéro.')) return;

    this.historyService
      .closeSession()
      .then(() => alert('Session clôturée avec succès.'))
      .catch((e: Error) => alert('Erreur lors de la clôture de la session : ' + e.message));
  }

  openMatchDetail(match: HistoryEntry): void {
    this.selectedMatchId.set(match.id);
  }

  closeMatchDetail(): void {
    this.selectedMatchId.set(null);
  }

  togglePaid(payload: { betId: string; currentStatus: boolean }): void {
    const matchId = this.selectedMatchId();
    if (!matchId) return;
    this.historyService.togglebetPaid(matchId, payload.betId, payload.currentStatus);
  }

  cancelHistoryMatch(): void {
    const matchId = this.selectedMatchId();
    if (!matchId) return;
    this.historyService.cancelHistoryMatch(matchId).then(() => this.selectedMatchId.set(null));
  }

  openSessionDetail(session: { id: string }): void {
    this.selectedSessionId.set(session.id);
  }

  closeSessionDetail(): void {
    this.selectedSessionId.set(null);
  }

  deleteSession(): void {
    const sessionId = this.selectedSessionId();
    if (!sessionId) return;
    this.historyService.cancelArchivedSession(sessionId).then(() => this.selectedSessionId.set(null));
  }

  openSettingsModal(): void {
    this.settingsModalOpen.set(true);
  }

  closeSettingsModal(): void {
    this.settingsModalOpen.set(false);
  }

  saveSettings(newSettings: AppSettings): void {
    this.settingsService.save(newSettings).then(() => this.settingsModalOpen.set(false));
  }

  resetAllData(): void {
    if (
      !confirm(
        '⚠️ ATTENTION : Voulez-vous vraiment effacer TOUS les joueurs, l’historique, les sessions et la draft ? Cette action est irréversible.',
      )
    ) {
      return;
    }
    const securityCheck = prompt("Tapez 'RESET' (en majuscule) pour confirmer la suppression définitive :");
    if (securityCheck !== 'RESET') return;

    this.adminService
      .resetAllData()
      .then(() => alert('Base de données vidée avec succès.'))
      .catch((e) => alert('Erreur lors de la réinitialisation : ' + e));
  }
}
