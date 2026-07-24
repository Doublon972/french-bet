import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { Observable } from 'rxjs';
import { FIREBASE_AUTH } from '../firebase.providers';

/**
 * Comme dans l'app d'origine : "admin" = n'importe quel utilisateur authentifié
 * (pas de rôles/claims Firebase). Le contrôle d'accès reste donc côté client.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth = inject(FIREBASE_AUTH);

  private readonly user$: Observable<User | null> = new Observable<User | null>((subscriber) => {
    return onAuthStateChanged(this.auth, (user) => subscriber.next(user));
  });

  readonly user: Signal<User | null | undefined> = toSignal(this.user$);
  readonly isAdmin: Signal<boolean> = computed(() => !!this.user());
  /** `false` tant que le tout premier callback `onAuthStateChanged` n'a pas encore été reçu. */
  readonly authReady: Signal<boolean> = computed(() => this.user() !== undefined);

  login(email: string, password: string): Promise<void> {
    return signInWithEmailAndPassword(this.auth, email, password).then(() => undefined);
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }
}
