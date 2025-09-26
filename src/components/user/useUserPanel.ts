// src/components/user/useUserPanel.ts
"use client";

import { useEffect, useState } from "react";
import { auth, storage } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

// Tipos
interface Subscription {
  status: string;
  plan: string;
  [key: string]: unknown;
}

interface ClonacionVideo {
  id: string;
  url: string;
  thumbnail?: string;
  storagePath?: string;
  uploading?: boolean;
}

export function useUserPanel() {
  const t = useT();
  const [user, setUser] = useState<User | null>(null);
  const [clonacionVideos, setClonacionVideos] = useState<ClonacionVideo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  // Props extra para evitar errores de TS en SubscriptionSection
  const loadingSub = false;
  const sub: Subscription | undefined = undefined;
  const getStatusChipStyle = () => "";
  const renderStatusLabel = (status: string) => status;

  // Cargar usuario
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (loggedUser) => {
      setUser(loggedUser);
      if (loggedUser) {
        await fetchClonacionVideos(loggedUser.uid);
      } else {
        setClonacionVideos([]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Cargar vídeos de clonación
  const fetchClonacionVideos = async (uid: string) => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No autenticado");

      const idToken = await currentUser.getIdToken();

      const res = await fetch(`/api/firebase/users/${uid}/clones`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error("Error al cargar videos de clonación");

      const vids: ClonacionVideo[] = await res.json();
      setClonacionVideos(vids.filter((v) => !!v.url));
    } catch (err) {
      console.error("fetchClonacionVideos error:", err);
      toast.error(t("clonacion.toasts.loadError"));
    }
  };

  // Subir vídeo (Optimistic UI)
  const handleUpload = async (file: File) => {
    if (!user) {
      toast.error(t("clonacion.toasts.mustLogin"));
      return;
    }

    const id = crypto.randomUUID();
    const storagePath = `users/${user.uid}/clones/${id}`;

    // Preview inmediata (optimistic)
    const tempVideo: ClonacionVideo = {
      id,
      url: URL.createObjectURL(file),
      storagePath,
      uploading: true,
    };
    setClonacionVideos((prev) => [tempVideo, ...prev]);
    setUploading(true);
    setProgress(0);

    try {
      // 1) Subir a Storage
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const prog = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setProgress(prog);
          },
          reject,
          resolve
        );
      });

      // 2) Obtener URL real
      const url = await getDownloadURL(storageRef);

      // 3) Persistir en tu API
      const token = await user.getIdToken();
      const res = await fetch(`/api/firebase/users/${user.uid}/clones`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          url,
          storagePath,
          createdAt: Date.now(),
        }),
      });

      if (!res.ok) throw new Error(`Error guardando clonación (${res.status})`);

      // Reemplazar temporal con definitivo
      setClonacionVideos((prev) =>
        prev.map((v) => (v.id === id ? { ...v, url, uploading: false } : v))
      );

      toast.success(t("clonacion.toasts.uploadSuccess"));
    } catch (err) {
      console.error("❌ Upload error:", err);
      toast.error(t("clonacion.toasts.uploadError"));
      // Revertir temp
      setClonacionVideos((prev) => prev.filter((v) => v.id !== id));
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  // Eliminar vídeo (Optimistic UI)
  const handleDelete = async (videoId: string, storagePath?: string) => {
    if (!user) return;

    const prevVideos = [...clonacionVideos];
    // Quitar inmediatamente
    setClonacionVideos((prev) => prev.filter((v) => v.id !== videoId));

    try {
      const token = await user.getIdToken();

      const res = await fetch(
        `/api/firebase/users/${user.uid}/clones/${videoId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error(`Error borrando doc (${res.status})`);

      if (storagePath) {
        try {
          await deleteObject(ref(storage, storagePath));
        } catch (storageErr) {
          console.warn("⚠️ Error borrando en Storage:", storageErr);
        }
      }

      toast.success(t("clonacion.toasts.deleteSuccess"));
    } catch (err) {
      console.error(err);
      toast.error(t("clonacion.toasts.deleteError"));
      // Revertir si falla
      setClonacionVideos(prevVideos);
    }
  };

  return {
    t,
    user,
    clonacionVideos,
    handleUpload,
    handleDelete,
    uploading,
    progress,
    loading,

    // Props extra para SubscriptionSection
    loadingSub,
    sub,
    getStatusChipStyle,
    renderStatusLabel,
  };
}
