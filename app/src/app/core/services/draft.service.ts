import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Database, ref, set } from 'firebase/database';
import { FIREBASE_DATABASE } from '../firebase.providers';
import { objectValue$ } from '../utils/rtdb.util';

export interface DraftState {
  teamA: string[];
  teamB: string[];
}

const EMPTY_DRAFT: DraftState = { teamA: [], teamB: [] };

@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly db: Database = inject(FIREBASE_DATABASE);

  private readonly raw = toSignal(objectValue$<DraftState>(this.db, 'draft'), { initialValue: null });

  readonly draft: Signal<DraftState> = computed(() => ({
    teamA: this.raw()?.teamA ?? [],
    teamB: this.raw()?.teamB ?? [],
  }));

  setDraft(teamA: string[], teamB: string[]): Promise<void> {
    return set(ref(this.db, 'draft'), { teamA, teamB });
  }

  clearDraft(): Promise<void> {
    return set(ref(this.db, 'draft'), EMPTY_DRAFT);
  }
}
