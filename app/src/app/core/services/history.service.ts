import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Database, push, ref, update } from 'firebase/database';
import { FIREBASE_DATABASE } from '../firebase.providers';
import { HistoryEntry, Session } from '../models/match.model';
import { Player } from '../models/player.model';
import { listValue$ } from '../utils/rtdb.util';
import { PlayersService } from './players.service';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly db: Database = inject(FIREBASE_DATABASE);
  private readonly playersService = inject(PlayersService);

  /** Matchs de la session en cours (non archivés), du plus récent au plus ancien. */
  readonly history: Signal<HistoryEntry[]> = computed(() => {
    const raw = this.rawHistory() ?? [];
    return raw
      .filter((m) => !!m.teamA_names)
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  /** Sessions archivées, de la plus récente à la plus ancienne. */
  readonly sessions: Signal<Session[]> = computed(() => {
    const raw = this.rawSessions() ?? [];
    return raw
      .filter((s) => !!s.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  /** Fusion chronologique (ascendante) de l'historique live et de tous les matchs archivés. */
  readonly allMatches: Signal<HistoryEntry[]> = computed(() => {
    const live = this.history();
    const archived: HistoryEntry[] = [];
    for (const session of this.sessions()) {
      if (!session.matches) continue;
      for (const matchId of Object.keys(session.matches)) {
        const match = session.matches[matchId] as Omit<HistoryEntry, 'id'> | undefined;
        if (match && typeof match === 'object') archived.push({ id: matchId, ...match });
      }
    }
    return [...archived, ...live].sort((a, b) => a.timestamp - b.timestamp);
  });

  private readonly rawHistory = toSignal(listValue$<Omit<HistoryEntry, 'id'>>(this.db, 'history'));
  private readonly rawSessions = toSignal(listValue$<Omit<Session, 'id'>>(this.db, 'sessions'));

  togglebetPaid(matchId: string, betId: string, currentStatus: boolean): Promise<void> {
    return update(ref(this.db), { [`history/${matchId}/bets/${betId}/paid`]: !currentStatus });
  }

  /** Annule un match de l'historique EN COURS : restaure l'Elo et les V/D des joueurs concernés. */
  cancelHistoryMatch(matchId: string): Promise<void> {
    const match = this.history().find((m) => m.id === matchId);
    if (!match) return Promise.resolve();

    const players = this.playersService.players() ?? [];
    const updates: Record<string, unknown> = {};

    if (match.eloChanges) {
      for (const playerId of Object.keys(match.eloChanges)) {
        const p = players.find((x) => x.id === playerId);
        if (p) updates[`players/${playerId}/elo`] = Math.max(100, p.elo - match.eloChanges[playerId]);
      }
    }

    this.reverseWinLoss(match.teamA_ids, match.winner === 'A', match.winner === 'B', players, updates);
    this.reverseWinLoss(match.teamB_ids, match.winner === 'B', match.winner === 'A', players, updates);

    updates[`history/${matchId}`] = null;
    return update(ref(this.db), updates);
  }

  private reverseWinLoss(
    ids: string[] | undefined,
    wasWin: boolean,
    wasLoss: boolean,
    players: Player[],
    updates: Record<string, unknown>,
  ): void {
    if (!ids) return;
    for (const id of ids) {
      const p = players.find((x) => x.id === id);
      if (!p) continue;
      updates[`players/${id}/wins`] = wasWin ? Math.max(0, p.wins - 1) : p.wins;
      updates[`players/${id}/losses`] = wasLoss ? Math.max(0, p.losses - 1) : p.losses;
    }
  }

  /** Archive tous les matchs de la session en cours dans `sessions` et calcule son P&L, puis vide `history`. */
  closeSession(): Promise<unknown> {
    const validMatches = this.history();
    if (validMatches.length === 0) return Promise.reject(new Error('Aucun match valide à clôturer.'));

    let sessionPnL = 0;
    const matchesObj: Record<string, Omit<HistoryEntry, 'id'>> = {};

    for (const match of validMatches) {
      if (match.bets) {
        for (const bet of Object.values(match.bets)) {
          if (bet.team === match.winner) sessionPnL -= bet.potentialWin - bet.amount;
          else sessionPnL += bet.amount;
        }
      }
      const { id, ...rest } = match;
      for (const k of Object.keys(rest) as (keyof typeof rest)[]) {
        if (rest[k] === undefined) delete rest[k];
      }
      matchesObj[id] = rest;
    }

    const newSession: Omit<Session, 'id'> = { timestamp: Date.now(), pnl: sessionPnL, matches: matchesObj };

    const newSessionRef = push(ref(this.db, 'sessions'));
    const updates: Record<string, unknown> = {
      [`sessions/${newSessionRef.key}`]: newSession,
      history: null,
    };

    return update(ref(this.db), updates);
  }

  /** Supprime une session archivée en restaurant l'Elo et les V/D de tous les joueurs impliqués. */
  cancelArchivedSession(sessionId: string): Promise<void> {
    const session = this.sessions().find((s) => s.id === sessionId);
    if (!session) return Promise.resolve();

    const players = this.playersService.players() ?? [];
    const playerUpdates = new Map<string, { elo: number; wins: number; losses: number }>();
    for (const p of players) playerUpdates.set(p.id, { elo: p.elo, wins: p.wins, losses: p.losses });

    const matches = session.matches ? Object.values(session.matches) : [];
    for (const match of matches) {
      if (match.eloChanges) {
        for (const playerId of Object.keys(match.eloChanges)) {
          const acc = playerUpdates.get(playerId);
          if (acc) acc.elo = Math.max(100, acc.elo - match.eloChanges[playerId]);
        }
      }
      this.reverseWinLossMap(match.teamA_ids, match.winner === 'A', match.winner === 'B', playerUpdates);
      this.reverseWinLossMap(match.teamB_ids, match.winner === 'B', match.winner === 'A', playerUpdates);
    }

    const updates: Record<string, unknown> = {};
    for (const [id, acc] of playerUpdates) {
      const p = players.find((x) => x.id === id);
      if (p && (p.elo !== acc.elo || p.wins !== acc.wins || p.losses !== acc.losses)) {
        updates[`players/${id}/elo`] = acc.elo;
        updates[`players/${id}/wins`] = acc.wins;
        updates[`players/${id}/losses`] = acc.losses;
      }
    }
    updates[`sessions/${sessionId}`] = null;

    return update(ref(this.db), updates);
  }

  private reverseWinLossMap(
    ids: string[] | undefined,
    wasWin: boolean,
    wasLoss: boolean,
    playerUpdates: Map<string, { elo: number; wins: number; losses: number }>,
  ): void {
    if (!ids) return;
    for (const id of ids) {
      const acc = playerUpdates.get(id);
      if (!acc) continue;
      acc.wins = wasWin ? Math.max(0, acc.wins - 1) : acc.wins;
      acc.losses = wasLoss ? Math.max(0, acc.losses - 1) : acc.losses;
    }
  }
}
