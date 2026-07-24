import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Database, ref, set } from 'firebase/database';
import { FIREBASE_DATABASE } from '../firebase.providers';
import { AppSettings, DEFAULT_SETTINGS } from '../models/settings.model';
import { defaultSettingsFrom } from '../utils/elo.util';
import { objectValue$ } from '../utils/rtdb.util';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly db: Database = inject(FIREBASE_DATABASE);

  private readonly raw = toSignal(objectValue$<Partial<AppSettings>>(this.db, 'settings'), {
    initialValue: null,
  });

  readonly settings: Signal<AppSettings> = computed(() => defaultSettingsFrom(this.raw() ?? DEFAULT_SETTINGS));

  save(settings: AppSettings): Promise<void> {
    return set(ref(this.db, 'settings'), settings);
  }
}
