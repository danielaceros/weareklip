"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom"; // 👈 clave
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";

type AudioItem = { id: string; audioUrl: string; name?: string };
type VideoItem = { id: string; url: string; name?: string };

export default function LipsyncCreatePage() {
  const [user, setUser] = useState<User | null>(null);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");

  const [loading, setLoading] = useState(false); // cuando el backend está procesando
  const [processing, setProcessing] = useState(false); // apenas clic

  const router = useRouter();
  const { ensureSubscribed } = useSubscriptionGate();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) await loadMedia(currentUser.uid);
    });
    return () => unsub();
  }, []);

  async function loadMedia(uid: string) {
    try {
      const audiosSnap = await getDocs(collection(db, "users", uid, "audios"));
      const a: AudioItem[] = audiosSnap.docs.map((doc) => {
        const data = doc.data() as Partial<AudioItem> & { audioUrl?: string };
        return {
          id: doc.id,
          audioUrl: data.audioUrl ?? "",
          name: data.name || doc.id,
        };
      });

      const videosSnap = await getDocs(collection(db, "users", uid, "clonacion"));
      const v: VideoItem[] = videosSnap.docs.map((doc) => {
        const data = doc.data() as Partial<VideoItem> & { url?: string; titulo?: string };
        return {
          id: doc.id,
          url: data.url ?? "",
          name: data.titulo || doc.id,
        };
      });

      setAudios(a);
      setVideos(v);
    } catch (err) {
      console.error(err);
      toast.error("Error cargando audios/vídeos");
    }
  }

  async function handleGenerate() {
    flushSync(() => {
      setProcessing(true);
    });

    const ok = await ensureSubscribed({ feature: "lipsync" });
    if (!ok) {
      toast.error("Necesitas suscripción para generar Lipsync.");
      setProcessing(false);
      return;
    }

    if (!user) {
      toast.error("Debes iniciar sesión.");
      setProcessing(false);
      return;
    }
    if (!selectedAudioId) {
      toast.error("Debes seleccionar un audio.");
      setProcessing(false);
      return;
    }
    if (!selectedVideoId) {
      toast.error("Debes seleccionar un vídeo.");
      setProcessing(false);
      return;
    }

    const audio = audios.find((a) => a.id === selectedAudioId);
    const video = videos.find((v) => v.id === selectedVideoId);
    if (!audio?.audioUrl || !video?.url) {
      toast.error("Selecciona un audio y un vídeo válidos.");
      setProcessing(false);
      return;
    }

    setLoading(true);
    toast.info("Generando vídeo, por favor espera...");

    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/sync/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audioUrl: audio.audioUrl, videoUrl: video.url }),
      });

      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Error creando vídeo");

      toast.success("✅ Vídeo en proceso. Te avisaremos cuando esté listo.");
      router.push("/dashboard/video");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo crear el lipsync");
    } finally {
      setLoading(false);
      setProcessing(false);
    }
  }

  const isLoading = processing || loading;
  const buttonText = processing
    ? "Procesando..."
    : loading
    ? "Generando..."
    : "Generar video";

  return (
    <div className="w-full max-w-xl mx-auto rounded-2xl space-y-8 p-6">
      <h2 className="text-2xl font-bold">Generación de video</h2>

      {/* Selects */}
      <div className="space-y-6">
        {/* Audio */}
        <div>
          <p className="text-sm font-medium mb-2">Audio</p>
          <Select onValueChange={setSelectedAudioId}>
            <SelectTrigger className="truncate">
              <SelectValue placeholder="Seleccionar audio de clonación" />
            </SelectTrigger>
            <SelectContent>
              {audios.length > 0 ? (
                audios.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name || `Audio ${a.id.slice(0, 6)}`}
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

        {/* Video */}
        <div>
          <p className="text-sm font-medium mb-2">Video</p>
          <Select onValueChange={setSelectedVideoId}>
            <SelectTrigger className="truncate">
              <SelectValue placeholder="Seleccionar video de clonación" />
            </SelectTrigger>
            <SelectContent>
              {videos.length > 0 ? (
                videos.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name || `Video ${v.id.slice(0, 6)}`}
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
      </div>

      {/* Botón */}
      <Button onClick={handleGenerate} disabled={isLoading} className="w-full">
        {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        {buttonText}
      </Button>
    </div>
  );
}
