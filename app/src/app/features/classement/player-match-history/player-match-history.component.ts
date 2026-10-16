import { Component, Input, computed, signal } from '@angular/core';
import { HistoryEntry, Player } from '../../../core/models';
import { isMatchWin } from '../classement.util';

interface HistoryRow {
  id: string;
  isWin: boolean;
  dateStr: string;
  eloText: string;
  eloClass: string;
  winner: 'A' | 'B';
  teamANames: string[];
  teamBNames: string[];
}

@Component({
  selector: 'app-player-match-history',
  standalone: true,
  templateUrl: './player-match-history.component.html',
  // `display:contents` : le tag <app-player-match-history> disparaît de l'arbre de boîtes
  // pour que son <ul class="flex-grow h-0"> devienne un vrai enfant flex du conteneur
  // parent (sinon le tag hôte, `display:inline` par défaut, casse le contexte flex et
  // `h-0` s'applique littéralement au lieu de "grandir pour remplir").
  host: { class: 'contents' },
})
export class PlayerMatchHistoryComponent {
  private readonly playerInput = signal<Player | null>(null);
  @Input() set player(value: Player | null | undefined) {
    this.playerInput.set(value ?? null);
  }

  private readonly matchesInput = signal<HistoryEntry[]>([]);
  @Input() set reversedMatches(value: HistoryEntry[] | undefined) {
    this.matchesInput.set(value ?? []);
  }

  readonly playerName = computed(() => this.playerInput()?.name ?? '');

  readonly rows = computed<HistoryRow[]>(() => {
    const player = this.playerInput();
    if (!player) return [];

    return this.matchesInput().map((m) => {
      const isWin = isMatchWin(m, player.id, player.name);
      const dateStr = new Date(m.timestamp).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

      const exactDelta = m.eloChanges?.[player.id];
      const delta = exactDelta !== undefined ? exactDelta : isWin ? 16 : -16;
      const eloText =
        exactDelta !== undefined
          ? delta > 0
            ? `+${Math.round(delta)}`
            : `${Math.round(delta)}`
          : delta > 0
            ? `~+${delta}`
            : `~${delta}`;
      const eloClass = delta > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold';

      return {
        id: m.id,
        isWin,
        dateStr,
        eloText,
        eloClass,
        winner: m.winner,
        teamANames: this.splitTeam(m.teamA_names),
        teamBNames: this.splitTeam(m.teamB_names),
      };
    });
  });

  isPlayerName(name: string): boolean {
    return name === this.playerInput()?.name;
  }

  private splitTeam(teamStr: string | undefined): string[] {
    if (!teamStr) return [];
    return teamStr.split(', ');
  }
}
