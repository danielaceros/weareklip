// src/components/video/LipsyncCreatePage.tsx
"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { AudioSelect } from "./AudioSelect";
import { VideoSelect } from "./VideoSelect";
import { GenerateButton } from "./GenerateButton";

import useSubscriptionGate from "@/hooks/useSubscriptionGate";

type AudioItem = { id: string; audioUrl: string; name?: string };
type VideoItem = { id: string; url: string; name?: string };

export default function LipsyncCreatePage() {
  const [user, setUser] = useState<User | null>(null);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [loading, setLoading] = useState(false);

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

      const videosSnap = await getDocs(
        collection(db, "users", uid, "clonacion")
      );
      const v: VideoItem[] = videosSnap.docs.map((doc) => {
        const data = doc.data() as Partial<VideoItem> & {
          url?: string;
          titulo?: string;
        };
        return { id: doc.id, url: data.url ?? "", name: data.titulo || doc.id };
      });

      setAudios(a);
      setVideos(v);
    } catch (err) {
      console.error(err);
      toast.error("Error cargando audios/vídeos");
    }
  }

  async function handleGenerate() {
    // Paywall: si no tiene método de pago, el hook redirige a facturación.
    const ok = await ensureSubscribed({ feature: "lipsync" });
    if (!ok) return;

    if (!user) return toast.error("Debes iniciar sesión");

    const audio = audios.find((a) => a.id === selectedAudioId);
    const video = videos.find((v) => v.id === selectedVideoId);
    if (!audio?.audioUrl || !video?.url) {
      return toast.error("Selecciona un audio y un vídeo válidos");
    }

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const res = await fetch("/api/sync/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ audioUrl: audio.audioUrl, videoUrl: video.url }),
      });

      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Error creando vídeo");

      toast.success("✅ Vídeo en proceso. Te avisaremos cuando esté listo.");
      router.push("/dashboard/video"); // <-- ahora sí usamos router
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "No se pudo crear el lipsync"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">Nuevo vídeo con lipsync</h1>
      <AudioSelect audios={audios} onChange={setSelectedAudioId} />
      <VideoSelect videos={videos} onChange={setSelectedVideoId} />
      <GenerateButton loading={loading} onClick={handleGenerate} />
    </div>
  );
}
