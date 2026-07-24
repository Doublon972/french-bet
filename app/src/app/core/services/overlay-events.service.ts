import { Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { ActiveMatch, HistoryEntry, Player } from '../models';
import { computeEloRecords, computeRankMovements, EloRecord, RankMovement } from '../utils/overlay.util';
import { HistoryService } from './history.service';
import { MatchService } from './match.service';
import { PlayersService } from './players.service';

export type OverlayEvent =
  | {
      kind: 'victory';
      key: string;
      winnerNames: string;
      loserNames: string;
      winnerSide: 'A' | 'B';
      odds: string;
      durationMs: number;
    }
  | { kind: 'rank-movement'; key: string; movements: RankMovement[]; durationMs: number }
  | { kind: 'elo-record'; key: string; record: EloRecord; durationMs: number };

const VICTORY_DURATION_MS = 5500;
const RANK_MOVEMENT_DURATION_MS = 7000;
const ELO_RECORD_DURATION_MS = 5500;
const ADVANCE_CHECK_INTERVAL_MS = 300;

/**
 * Firebase `onValue` livre les données en plusieurs vagues au chargement (un premier snapshot
 * parfois vide/partiel depuis le cache local, puis les données complètes juste après depuis le
 * serveur). Tant que cette fenêtre n'est pas écoulée depuis la construction du service, toute
 * mise à jour sert uniquement à ajuster la référence "déjà connu", sans jamais déclencher
 * d'événement — sinon la 2e vague (avec tout l'historique réel) serait prise pour une avalanche
 * de "nouveaux" matchs.
 */
const WARMUP_MS = 3000;

/**
 * Quand un match se résout, Firebase applique le nouvel elo des joueurs et pousse la nouvelle
 * entrée d'historique dans une seule écriture atomique côté serveur — mais ce sont deux
 * écouteurs `onValue` distincts côté client (`players` et `history`), qui peuvent livrer leurs
 * mises à jour dans un ordre légèrement différent. On attend cette marge avant de lire l'elo
 * "après-match" des joueurs, pour éviter de comparer un nouvel historique à un elo pas encore
 * à jour (mouvements de classement / records faux).
 */
const PLAYERS_SETTLE_DELAY_MS = 700;

/**
 * Détecte les événements "temps réel" à afficher sur l'overlay de stream et les expose sous
 * forme de file d'attente affichée un par un (victoire, mouvements de classement, records Elo).
 * Ignore volontairement l'historique déjà présent au chargement de la page (un rechargement de
 * la source OBS ne doit pas rejouer tout l'historique).
 */
@Injectable({ providedIn: 'root' })
export class OverlayEventsService {
  private readonly matchService = inject(MatchService);
  private readonly historyService = inject(HistoryService);
  private readonly playersService = inject(PlayersService);

  /** Bannière persistante : affichée tant qu'un match est en cours, jusqu'à ce qu'un vainqueur soit déclaré. */
  readonly matchBanner: Signal<ActiveMatch | null> = computed(() => this.matchService.activeMatch() ?? null);

  private readonly queue: OverlayEvent[] = [];
  private readonly currentSignal = signal<OverlayEvent | null>(null);
  readonly current: Signal<OverlayEvent | null> = this.currentSignal.asReadonly();

  private currentShownAt = 0;
  private seenHistoryIds = new Set<string>();
  private readonly startedAt = Date.now();

  constructor() {
    effect(() => this.onAllMatchesChange(this.historyService.allMatches()));

    setInterval(() => this.tryAdvanceQueue(), ADVANCE_CHECK_INTERVAL_MS);
  }

  private get isWarmingUp(): boolean {
    return Date.now() - this.startedAt < WARMUP_MS;
  }

  private onAllMatchesChange(allMatches: HistoryEntry[]): void {
    if (this.isWarmingUp) {
      for (const m of allMatches) this.seenHistoryIds.add(m.id);
      return;
    }

    const newEntries = allMatches.filter((m) => !this.seenHistoryIds.has(m.id));
    for (const m of newEntries) this.seenHistoryIds.add(m.id);
    if (newEntries.length === 0) return;

    for (const entry of newEntries.sort((a, b) => a.timestamp - b.timestamp)) {
      this.enqueue({
        kind: 'victory',
        key: `victory-${entry.id}`,
        winnerNames: entry.winner === 'A' ? entry.teamA_names : entry.teamB_names,
        loserNames: entry.winner === 'A' ? entry.teamB_names : entry.teamA_names,
        winnerSide: entry.winner,
        odds: entry.winner === 'A' ? entry.oddsA : entry.oddsB,
        durationMs: VICTORY_DURATION_MS,
      });

      // Laisse le temps à l'écouteur `players` de rattraper celui de `history` avant de
      // calculer les mouvements de classement / records (cf. PLAYERS_SETTLE_DELAY_MS).
      setTimeout(() => this.enqueueMatchResolvedEvents(entry), PLAYERS_SETTLE_DELAY_MS);
    }
  }

  private enqueueMatchResolvedEvents(entry: HistoryEntry): void {
    const players = this.playersService.players() ?? [];
    const allMatches = this.historyService.allMatches();

    const movements = computeRankMovements(players, entry);
    if (movements.length > 0) {
      this.enqueue({
        kind: 'rank-movement',
        key: `rank-${entry.id}`,
        movements,
        durationMs: RANK_MOVEMENT_DURATION_MS,
      });
    }

    const records = computeEloRecords(players, allMatches, entry);
    for (const record of records) {
      this.enqueue({
        kind: 'elo-record',
        key: `record-${entry.id}-${record.playerId}`,
        record,
        durationMs: ELO_RECORD_DURATION_MS,
      });
    }
  }

  private enqueue(event: OverlayEvent): void {
    this.queue.push(event);
    this.tryAdvanceQueue();
  }

  private tryAdvanceQueue(): void {
    const current = this.currentSignal();
    if (current) {
      const elapsed = Date.now() - this.currentShownAt;
      if (elapsed < current.durationMs) return;
    }

    const next = this.queue.shift() ?? null;
    this.currentSignal.set(next);
    this.currentShownAt = Date.now();
  }
}
