"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { AudiosList, AudioData } from "./AudiosList";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from "@/components/ui/dialog";
import AudioCreatorContainer from "./AudioCreatorContainer"; // 👈 importante

export default function AudiosContainer() {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  const fetchAudios = useCallback(async () => {
    if (!user) return;
    try {
      const audiosRef = collection(db, "users", user.uid, "audios");
      const snapshot = await getDocs(audiosRef);
      const data: AudioData[] = snapshot.docs.map((docSnap) => {
        const docData = docSnap.data() as Partial<AudioData> & { audioUrl?: string };
        return {
          audioId: docSnap.id,
          url: docData.audioUrl ?? "",
          name: docData.name ?? "",
          description: docData.description ?? "",
          createdAt: docData.createdAt,
          duration: docData.duration,
          language: docData.language,
        };
      });
      setAudios(data);
    } catch (error) {
      console.error("Error fetching audios:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAudios();
  }, [fetchAudios]);

  const handleDelete = async (audioId: string) => {
    if (!user) return;
    if (!confirm("¿Eliminar este audio?")) return;
    await deleteDoc(doc(db, "users", user.uid, "audios", audioId));
    setAudios((prev) => prev.filter((a) => a.audioId !== audioId));
  };

  if (loading) return <p>Cargando audios...</p>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mis audios</h1>
        <Button
          onClick={() => setIsNewOpen(true)}
          className="rounded-lg"
        >
          + Nuevo audio
        </Button>
      </div>

      {/* Lista de audios */}
      <AudiosList audios={audios} onDelete={handleDelete} />

      {/* Modal de crear audio */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-3xl w-full rounded-xl">
          <AudioCreatorContainer /> {/* 👈 aquí metemos el form real */}
        </DialogContent>
      </Dialog>
    </div>
  );
}
