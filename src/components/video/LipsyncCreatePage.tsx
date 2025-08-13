"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AudioSelect } from "./AudioSelect";
import { VideoSelect } from "./VideoSelect";
import { GenerateButton } from "./GenerateButton";

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

export default function LipsyncPage() {
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
    } catch (err) {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-bold">Nuevo vídeo con lipsync</h1>

      <AudioSelect audios={audios} onChange={setSelectedAudio} />
      <VideoSelect videos={videos} onChange={setSelectedVideo} />
      <GenerateButton loading={loading} onClick={handleGenerate} />
    </div>
  );
}
