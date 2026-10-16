import { Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Database, push, ref, update } from 'firebase/database';
import { FIREBASE_DATABASE } from '../firebase.providers';
import { Player } from '../models/player.model';
import { listValue$ } from '../utils/rtdb.util';

@Injectable({ providedIn: 'root' })
export class PlayersService {
  private readonly db: Database = inject(FIREBASE_DATABASE);

  readonly players: Signal<Player[] | undefined> = toSignal(listValue$<Omit<Player, 'id'>>(this.db, 'players'));

  addPlayer(name: string, baseElo: number): Promise<void> {
    return push(ref(this.db, 'players'), { name, elo: baseElo, wins: 0, losses: 0 }).then(() => undefined);
  }

  renamePlayer(id: string, newName: string): Promise<void> {
    return update(ref(this.db, `players/${id}`), { name: newName });
  }
}
