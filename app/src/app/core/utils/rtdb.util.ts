import { Database, DatabaseReference, onValue, ref } from 'firebase/database';
import { Observable } from 'rxjs';

/** Observable temps réel sur un noeud objet unique (ex: 'settings', 'activeMatch'). Émet `null` si absent. */
export function objectValue$<T>(db: Database, path: string): Observable<T | null> {
  return new Observable<T | null>((subscriber) => {
    const nodeRef = ref(db, path);
    const unsubscribe = onValue(
      nodeRef,
      (snapshot) => subscriber.next((snapshot.val() as T) ?? null),
      (error) => subscriber.error(error),
    );
    return () => unsubscribe();
  });
}

/** Observable temps réel sur un noeud "map" (ex: 'players', 'history'), reconverti en tableau avec `id`. */
export function listValue$<T extends object>(db: Database, path: string): Observable<(T & { id: string })[]> {
  return new Observable<(T & { id: string })[]>((subscriber) => {
    const nodeRef = ref(db, path);
    const unsubscribe = onValue(
      nodeRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, T> | null;
        const list: (T & { id: string })[] = [];
        if (data) {
          for (const key of Object.keys(data)) {
            const entry = data[key];
            if (entry && typeof entry === 'object') {
              list.push({ id: key, ...entry });
            }
          }
        }
        subscriber.next(list);
      },
      (error) => subscriber.error(error),
    );
    return () => unsubscribe();
  });
}

export function refAt(db: Database, path: string): DatabaseReference {
  return ref(db, path);
}
