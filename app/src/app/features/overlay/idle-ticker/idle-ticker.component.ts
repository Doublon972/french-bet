import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { PlayersService } from '../../../core/services/players.service';
import { buildGroups, rankByAvgElo, rankByElo } from '../../../core/utils/groups.util';

const ROTATE_INTERVAL_MS = 7000;
const TOP_N = 5;

/**
 * Affiché sur l'overlay quand rien d'autre ne se passe (pas de match en cours, pas de popup
 * d'événement) : fait défiler en boucle le top joueurs puis le top groupes, pour que l'overlay
 * ne soit jamais un écran vide entre deux combats.
 */
@Component({
  selector: 'app-idle-ticker',
  standalone: true,
  templateUrl: './idle-ticker.component.html',
})
export class IdleTickerComponent implements OnDestroy {
  private readonly playersService = inject(PlayersService);
  private readonly intervalId: ReturnType<typeof setInterval>;

  readonly showGroups = signal(false);

  readonly rankedPlayers = computed(() => rankByElo(this.playersService.players() ?? []).slice(0, TOP_N));
  readonly rankedGroups = computed(() =>
    rankByAvgElo(buildGroups(this.playersService.players() ?? [])).slice(0, TOP_N),
  );

  readonly hasAnyData = computed(() => this.rankedPlayers().length > 0 || this.rankedGroups().length > 0);

  constructor() {
    this.intervalId = setInterval(() => this.showGroups.update((v) => !v), ROTATE_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  round(value: number): number {
    return Math.round(value);
  }
}
