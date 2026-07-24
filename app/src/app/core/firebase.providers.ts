import { InjectionToken } from '@angular/core';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';
import { environment } from '../../environments/environment';

const firebaseApp: FirebaseApp = initializeApp(environment.firebase);
const database: Database = getDatabase(firebaseApp);
const auth: Auth = getAuth(firebaseApp);

export const FIREBASE_APP = new InjectionToken<FirebaseApp>('FIREBASE_APP', {
  providedIn: 'root',
  factory: () => firebaseApp,
});

export const FIREBASE_DATABASE = new InjectionToken<Database>('FIREBASE_DATABASE', {
  providedIn: 'root',
  factory: () => database,
});

export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH', {
  providedIn: 'root',
  factory: () => auth,
});
