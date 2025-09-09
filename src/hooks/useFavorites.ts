// src/hooks/useFavorites.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Firestore } from "firebase/firestore";
import {
  FavoritesDriver,
  LocalStorageDriver,
  FirestoreDriver,
  mergeUnique,
  getId,
  STORAGE_KEY,
  type Favorite,
} from "@/lib/favorites-persistence";

type Params = {
  user?: { uid: string } | null; // Firebase Auth user (puede ser null)
  db?: Firestore;                // Firestore instance (opcional)
  driver?: FavoritesDriver;      // para tests o inyección
};

export function useFavorites({ user, db, driver }: Params = {}) {
  const local = useRef(new LocalStorageDriver());
  const remote = useRef<FavoritesDriver | null>(null);

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  // Carga inicial: primero LocalStorage; si hay user+db, merge con Firestore
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const base = await (driver ?? local.current).load();
      let merged = base;

      const uid = user?.uid ?? null;

      if (uid && db) {
        // prepara driver remoto para este uid
        remote.current = new FirestoreDriver(db, uid);
        const cloud = await remote.current.load();
        merged = mergeUnique(base, cloud);
      } else {
        remote.current = null;
      }

      if (!cancelled) {
        setFavorites(merged);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // ✅ Incluimos `user` porque se usa dentro del effect
  }, [user, db, driver]);

  // Persistencia: siempre LocalStorage; si hay Firestore, también allí
  useEffect(() => {
    if (loading) return;

    (driver ?? local.current).save(favorites);

    if (remote.current) {
      remote.current.save(favorites).catch(() => {});
    }
  }, [favorites, loading, driver]);

  // Sincroniza entre pestañas del navegador
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const items = JSON.parse(e.newValue);
          setFavorites(items);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isFavorite = useCallback(
    (itemOrId: string | Favorite) => {
      const id = typeof itemOrId === "string" ? itemOrId : getId(itemOrId);
      if (!id) return false;
      return favorites.some((f) => getId(f) === id);
    },
    [favorites]
  );

  const addFavorite = useCallback((item: Favorite) => {
    const id = getId(item);
    if (!id) return;
    setFavorites((prev) =>
      prev.some((f) => getId(f) === id) ? prev : [item, ...prev]
    );
  }, []);

  const removeFavorite = useCallback((itemOrId: string | Favorite) => {
    const id = typeof itemOrId === "string" ? itemOrId : getId(itemOrId);
    if (!id) return;
    setFavorites((prev) => prev.filter((f) => getId(f) !== id));
  }, []);

  const toggleFavorite = useCallback(
    (item: Favorite) => {
      isFavorite(item) ? removeFavorite(item) : addFavorite(item);
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  const clearFavorites = useCallback(() => setFavorites([]), []);

  return {
    favorites,
    loading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
  };
}
