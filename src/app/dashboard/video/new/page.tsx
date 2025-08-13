"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface AudioItem {
  id: string;
  audioUrl: string;
  name?: string;
}

interface VideoItem {
  id: string;
  url: string;
  name?: string;
}

export default function NewVideoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadMedia(currentUser.uid);
      }
    });
    return () => unsub();
  }, []);

  const loadMedia = async (uid: string) => {
    try {
      const audiosSnap = await getDocs(collection(db, "users", uid, "audios"));
      const videosSnap = await getDocs(collection(db, "users", uid, "clonacion"));

      setAudios(
        audiosSnap.docs.map((doc) => {
          const data = doc.data() as Partial<AudioItem> & { audioUrl?: string };
          return {
            id: doc.id,
            audioUrl: data.audioUrl ?? "",
            name: data.name || doc.id,
          };
        })
      );

      setVideos(
        videosSnap.docs.map((doc) => {
          const data = doc.data() as Partial<VideoItem> & { url?: string; titulo?: string };
          return {
            id: doc.id,
            url: data.url ?? "",
            name: data.titulo || doc.id,
          };
        })
      );
    } catch (err: unknown) {
      toast.error("Error cargando medios");
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    const audio = audios.find((a) => a.id === selectedAudio);
    const video = videos.find((v) => v.id === selectedVideo);

    if (!audio?.audioUrl || !video?.url) {
      toast.error("Debes seleccionar un audio y un vídeo válidos");
      return;
    }
    if (!user) {
      toast.error("No estás autenticado");
      return;
    }

    setLoading(true);
    toast.info("Enviando solicitud de generación...");

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/sync/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioUrl: audio.audioUrl,
          videoUrl: video.url,
        }),
      });

      const data: { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Error creando vídeo");

      toast.success("Solicitud enviada. El vídeo se generará en breve.");
      router.push("/dashboard/video");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">Nuevo vídeo con lipsync</h1>

      <div>
        <p className="mb-1">Selecciona audio</p>
        <Select onValueChange={setSelectedAudio}>
          <SelectTrigger>
            <SelectValue placeholder="Elige un audio" />
          </SelectTrigger>
          <SelectContent>
            {audios.length > 0 ? (
              audios.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No tienes audios disponibles
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="mb-1">Selecciona vídeo de clonación</p>
        <Select onValueChange={setSelectedVideo}>
          <SelectTrigger>
            <SelectValue placeholder="Elige un vídeo" />
          </SelectTrigger>
          <SelectContent>
            {videos.length > 0 ? (
              videos.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No tienes vídeos de clonación
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleGenerate} disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        Generar vídeo
      </Button>
    </div>
  );
}
