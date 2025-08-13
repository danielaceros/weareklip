"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AudiosList, AudioData } from "./AudiosList";

export default function AudiosContainer() {
  const [audios, setAudios] = useState<AudioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

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
    <div className="relative">
      <div className="absolute right-0 -top-2 mb-4">
        <Link href="/dashboard/audio/new">
          <Button className="bg-blue-500 hover:bg-blue-600 text-white">
            + Nuevo audio
          </Button>
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6 mt-10">Mis audios</h1>

      <AudiosList audios={audios} onDelete={handleDelete} />
    </div>
  );
}
