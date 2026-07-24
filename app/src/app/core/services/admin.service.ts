import { Injectable, inject } from '@angular/core';
import { Database, ref, update } from 'firebase/database';
import { FIREBASE_DATABASE } from '../firebase.providers';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly db: Database = inject(FIREBASE_DATABASE);

  /** Efface joueurs, draft, match actif, historique et sessions. Les réglages sont conservés. */
  resetAllData(): Promise<unknown> {
    return update(ref(this.db), {
      players: null,
      draft: null,
      activeMatch: null,
      history: null,
      sessions: null,
    });
  }
}
