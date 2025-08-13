"use client";

import { useEffect, useState } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import toast from "react-hot-toast";
import { useT } from "@/lib/i18n";

// Definir un tipo para la suscripción sin usar any
interface Subscription {
  status: string;
  plan: string;
  [key: string]: unknown; // Usamos 'unknown' en vez de 'any'
}

interface ClonacionVideo {
  id: string;
  url: string;
  thumbnail?: string;
}

export function useUserPanel() {
  const t = useT();
  const [user, setUser] = useState<User | null>(null);
  const [clonacionVideos, setClonacionVideos] = useState<ClonacionVideo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Props extra para evitar errores de TS en SubscriptionSection
  const loadingSub = false;
  const sub: Subscription | undefined = undefined; // Cambiado null por undefined
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
    });
    return () => unsub();
  }, []);

  // Cargar vídeos de clonación
  const fetchClonacionVideos = async (uid: string) => {
    const snap = await getDocs(collection(db, `users/${uid}/clonacion`));
    const vids = snap.docs.map((doc) => doc.data() as ClonacionVideo);
    setClonacionVideos(vids);
  };

  // Subir vídeo
  const handleUpload = async (file: File) => {
    if (!user) {
      toast.error(t("clonacion.mustLogin"));
      return;
    }

    const id = crypto.randomUUID();
    const storageRef = ref(storage, `users/${user.uid}/clonacion/${id}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setUploading(true);
    setProgress(0);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const prog = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setProgress(prog);
      },
      (error) => {
        console.error(error);
        toast.error(t("clonacion.uploadError"));
        setUploading(false);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);

        await setDoc(doc(db, `users/${user.uid}/clonacion/${id}`), {
          id,
          url,
          createdAt: serverTimestamp(),
        });

        toast.success(t("clonacion.uploadSuccess"));
        setUploading(false);
        setProgress(0);
        await fetchClonacionVideos(user.uid);
      }
    );
  };

  // Eliminar vídeo
  const handleDelete = async (videoId: string) => {
    if (!user) return;
    if (!confirm(t("clonacion.confirmDelete"))) return;

    try {
      await deleteDoc(doc(db, `users/${user.uid}/clonacion/${videoId}`));
      await deleteObject(ref(storage, `users/${user.uid}/clonacion/${videoId}`));
      toast.success(t("clonacion.deleteSuccess"));
      await fetchClonacionVideos(user.uid);
    } catch (error) {
      console.error(error);
      toast.error(t("clonacion.deleteError"));
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

    // Props extra para SubscriptionSection
    loadingSub,
    sub,
    getStatusChipStyle,
    renderStatusLabel,
  };
}
