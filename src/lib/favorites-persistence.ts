import type { Firestore } from "firebase/firestore";
import { doc, getDoc, setDoc } from "firebase/firestore";

export type Favorite = Record<string, any> & {
  id?: string;       // si tu modelo usa "id"
  videoId?: string;  // o "videoId" (ajústalo si usas otro)
};

export const STORAGE_KEY = "ideas:favorites:v1";

// Detecta un identificador estable del ítem
export const getId = (item: Favorite) =>
  (item?.id as string) ??
  (item?.videoId as string) ??
  (item as any)?.video_id ??
  (item as any)?.url ??
  null;

export interface FavoritesDriver {
  load(): Promise<Favorite[]>;
  save(items: Favorite[]): Promise<void>;
}

export class LocalStorageDriver implements FavoritesDriver {
  async load(): Promise<Favorite[]> {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  async save(items: Favorite[]): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }
}

export class FirestoreDriver implements FavoritesDriver {
  constructor(private db: Firestore, private uid: string) {}
  private ref() {
    // Ruta del documento donde guardamos los favoritos
    return doc(this.db, "users", this.uid, "appState", "ideasFavorites");
  }
  async load(): Promise<Favorite[]> {
    const snap = await getDoc(this.ref());
    if (!snap.exists()) return [];
    const data = snap.data() as any;
    return Array.isArray(data?.items) ? data.items : [];
  }
  async save(items: Favorite[]): Promise<void> {
    await setDoc(this.ref(), { items }, { merge: true });
  }
}

// Une dos listas, sin duplicados (por id)
export function mergeUnique(a: Favorite[], b: Favorite[]) {
  const map = new Map<string, Favorite>();
  for (const it of [...a, ...b]) {
    const id = getId(it);
    if (!id) continue;
    map.set(id, { ...map.get(id), ...it });
  }
  return [...map.values()];
}
