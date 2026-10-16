import { Component, computed, inject, signal } from '@angular/core';
import { HeaderComponent } from '../../shared/header/header.component';
import { HistoryService } from '../../core/services/history.service';
import { PlayersService } from '../../core/services/players.service';
import { isPlayerInMatch } from './classement.util';
import { PlayerDetailPanelComponent } from './player-detail-panel/player-detail-panel.component';
import { PlayerLeaderboardComponent } from './player-leaderboard/player-leaderboard.component';
import { rankByElo } from '../../core/utils/groups.util';

@Component({
  selector: 'app-classement-page',
  standalone: true,
  imports: [HeaderComponent, PlayerLeaderboardComponent, PlayerDetailPanelComponent],
  templateUrl: './classement-page.component.html',
})
export class ClassementPageComponent {
  private readonly playersService = inject(PlayersService);
  private readonly historyService = inject(HistoryService);

  readonly selectedPlayerId = signal<string | null>(null);

  readonly rankedPlayers = computed(() => rankByElo(this.playersService.players() ?? []));

  readonly totalPlayerCount = computed(() => this.rankedPlayers().length);

  readonly selectedPlayer = computed(() => {
    const id = this.selectedPlayerId();
    if (!id) return null;
    return this.rankedPlayers().find((p) => p.id === id) ?? null;
  });

  /** Matchs du joueur sélectionné, du plus récent au plus ancien. */
  readonly reversedPlayerMatches = computed(() => {
    const player = this.selectedPlayer();
    if (!player) return [];
    const matches = this.historyService
      .allMatches()
      .filter((m) => isPlayerInMatch(m, player.id, player.name));
    return [...matches].reverse();
  });

  selectPlayer(id: string): void {
    this.selectedPlayerId.set(id);
  }
}
