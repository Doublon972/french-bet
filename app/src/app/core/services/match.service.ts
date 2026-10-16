import { Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Database, push, ref, set, update } from 'firebase/database';
import { FIREBASE_DATABASE } from '../firebase.providers';
import { ActiveMatch, HistoryEntry } from '../models/match.model';
import { Player } from '../models/player.model';
import { AppSettings } from '../models/settings.model';
import { TeamSide } from '../models/bet.model';
import { applyEloFloor, averageElo, computeOdds, eloDeltaOnLoss, eloDeltaOnWin, expectedScoreA } from '../utils/elo.util';
import { objectValue$ } from '../utils/rtdb.util';
import { DraftService } from './draft.service';

@Injectable({ providedIn: 'root' })
export class MatchService {
  private readonly db: Database = inject(FIREBASE_DATABASE);
  private readonly draftService = inject(DraftService);

  readonly activeMatch: Signal<ActiveMatch | null | undefined> = toSignal(
    objectValue$<ActiveMatch>(this.db, 'activeMatch'),
  );

  /** Crée le match actif à partir des équipes formées en draft, puis vide la draft (comme l'original). */
  async createMatch(teamAPlayers: Player[], teamBPlayers: Player[], settings: AppSettings): Promise<void> {
    const eloA = averageElo(teamAPlayers.map((p) => p.elo));
    const eloB = averageElo(teamBPlayers.map((p) => p.elo));

    const probA = expectedScoreA(eloA, eloB);
    const probB = 1 - probA;

    const newMatch: ActiveMatch = {
      teamA: teamAPlayers,
      teamB: teamBPlayers,
      oddsA: computeOdds(probA, settings.baseOdds),
      oddsB: computeOdds(probB, settings.baseOdds),
      probA,
      probB,
      bets: {},
    };

    await set(ref(this.db, 'activeMatch'), newMatch);
    await this.draftService.clearDraft();
  }

  cancelMatch(): Promise<void> {
    return set(ref(this.db, 'activeMatch'), null);
  }

  placeBet(activeMatch: ActiveMatch, team: TeamSide, bettorName: string, amount: number): Promise<void> {
    const odds = parseFloat(team === 'A' ? activeMatch.oddsA : activeMatch.oddsB);
    return push(ref(this.db, 'activeMatch/bets'), {
      user: bettorName || 'Anonyme',
      team,
      amount,
      potentialWin: amount * odds,
      paid: false,
    }).then(() => undefined);
  }

  cancelActiveBet(betId: string): Promise<void> {
    return update(ref(this.db), { [`activeMatch/bets/${betId}`]: null });
  }

  /** Résout le match en cours : calcule les deltas Elo, met à jour les joueurs et archive dans l'historique. */
  resolveMatch(activeMatch: ActiveMatch, winner: TeamSide, settings: AppSettings): Promise<unknown> {
    const eloChangeA = winner === 'A'
      ? eloDeltaOnWin(settings.kWin, activeMatch.probA)
      : eloDeltaOnLoss(settings.kLoss, activeMatch.probA);
    const eloChangeB = winner === 'B'
      ? eloDeltaOnWin(settings.kWin, activeMatch.probB)
      : eloDeltaOnLoss(settings.kLoss, activeMatch.probB);

    const updates: Record<string, unknown> = {};
    const eloChangesLog: Record<string, number> = {};

    for (const p of activeMatch.teamA) {
      const newElo = applyEloFloor(p.elo, eloChangeA);
      eloChangesLog[p.id] = newElo - p.elo;
      updates[`players/${p.id}/elo`] = newElo;
      updates[`players/${p.id}/wins`] = winner === 'A' ? p.wins + 1 : p.wins;
      updates[`players/${p.id}/losses`] = winner === 'B' ? p.losses + 1 : p.losses;
    }
    for (const p of activeMatch.teamB) {
      const newElo = applyEloFloor(p.elo, eloChangeB);
      eloChangesLog[p.id] = newElo - p.elo;
      updates[`players/${p.id}/elo`] = newElo;
      updates[`players/${p.id}/wins`] = winner === 'B' ? p.wins + 1 : p.wins;
      updates[`players/${p.id}/losses`] = winner === 'A' ? p.losses + 1 : p.losses;
    }

    const historyEntry: Omit<HistoryEntry, 'id'> = {
      timestamp: Date.now(),
      teamA_names: activeMatch.teamA.map((p) => p.name).join(', '),
      teamB_names: activeMatch.teamB.map((p) => p.name).join(', '),
      teamA_ids: activeMatch.teamA.map((p) => p.id),
      teamB_ids: activeMatch.teamB.map((p) => p.id),
      oddsA: activeMatch.oddsA,
      oddsB: activeMatch.oddsB,
      winner,
      bets: activeMatch.bets ?? {},
      eloChanges: eloChangesLog,
    };

    const newHistoryRef = push(ref(this.db, 'history'));
    updates[`history/${newHistoryRef.key}`] = historyEntry;
    updates['activeMatch'] = null;

    return update(ref(this.db), updates);
  }
}
