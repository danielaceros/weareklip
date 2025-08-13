"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import Link from "next/link";

interface AudioData {
  audioId: string;
  name?: string;
  description?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  url: string;
  duration?: string;
  language?: string;
}

export default function AudiosPage() {
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

      {audios.length === 0 && <p>No tienes audios aún.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {audios.map((audio) => (
          <Card key={audio.audioId} className="overflow-hidden">
            <CardHeader className="p-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold truncate">{audio.name || "Sin título"}</h3>
                <div className="flex gap-1 mt-1">
                  {audio.language && <Badge variant="outline">{audio.language}</Badge>}
                  {audio.duration && <Badge variant="outline">{audio.duration}</Badge>}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3">
              {audio.description && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-3">{audio.description}</p>
              )}
              <audio controls src={audio.url} className="w-full" />
            </CardContent>

            <CardFooter className="p-3 flex justify-between items-center">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(audio.audioId)}
              >
                <Trash2 size={14} />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
