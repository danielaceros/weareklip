"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useAudioForm } from "./useAudioForm";
import { AudioForm } from "./AudioForm";
import { v4 as uuidv4 } from "uuid";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";

export default function AudioCreatorContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultText = searchParams.get("text") || "";
  const form = useAudioForm(defaultText);

  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioId, setAudioId] = useState<string>(""); // padre
  const [regenCount, setRegenCount] = useState<number>(0);
  const [showModal, setShowModal] = useState<boolean>(false);

  // 🎵 Control de audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
  if (!audioRef.current) return;

  if (isPlaying) {
    audioRef.current.pause();
  } else {
    audioRef.current.play().catch((err) => {
      console.warn("No se pudo reproducir:", err);
    });
  }
};


  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const p =
      (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(p);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  // 👉 helper para enviar el body correcto
  const buildVoiceSettings = () => ({
    stability: form.stability ?? null,
    similarity_boost: form.similarityBoost ?? null,
    style: form.style ?? null,
    speed: form.speed ?? null,
    use_speaker_boost: form.speakerBoost ?? null,
  });

  // 👉 Generar audio inicial
  const handleGenerate = async () => {
    if (!form.text.trim()) {
      toast.error("Debes escribir el texto a convertir.");
      return;
    }
    if (!form.voiceId) {
      toast.error("Debes seleccionar una voz.");
      return;
    }
    if (!form.user) {
      toast.error("Debes iniciar sesión para generar audios.");
      return;
    }

    form.setLoading(true);
    const loadingId = toast.loading("🎙️ Generando audio...");

    try {
      const token = await form.user.getIdToken();
      const res = await fetch("/api/elevenlabs/audio/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify({
          text: form.text,
          voiceId: form.voiceId,
          voice_settings: buildVoiceSettings(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando audio");

      setAudioUrl(data.audioUrl);
      setAudioId(data.audioId); // guardamos padre
      setShowModal(true);
      setRegenCount(0);

      toast.success("✅ Audio generado", { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo generar el audio", { id: loadingId });
    } finally {
      form.setLoading(false);
    }
  };

  // 👉 Regenerar audio
  const handleRegenerate = async () => {
    if (!audioId) {
      toast.error("No hay audio base para regenerar.");
      return;
    }
    if (regenCount >= 2) {
      toast.error("⚠️ Máximo 2 regeneraciones permitidas.");
      return;
    }
    setRegenCount((c) => c + 1);
    const loadingId = toast.loading("🔄 Regenerando audio...");

    try {
      const token = await form.user?.getIdToken();
      const res = await fetch("/api/elevenlabs/audio/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify({
          parentAudioId: audioId, // ✅ referencia al padre
          text: form.text,
          voiceId: form.voiceId,
          voice_settings: buildVoiceSettings(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error regenerando audio");

      setAudioUrl(data.audioUrl);

      toast.success("✅ Audio regenerado", { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo regenerar", { id: loadingId });
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const handleAccept = () => {
    toast.success("📂 Audio guardado en tu biblioteca");
    setShowModal(false);
    router.push("/dashboard/audio");
  };

  return (
    <>
      <AudioForm {...form} onGenerate={handleGenerate} />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🎧 Audio generado</DialogTitle>
          </DialogHeader>

          {audioUrl && (
            <div className="bg-neutral-900 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>
                  <div className="w-full h-1 bg-neutral-700 rounded-full">
                    <div
                      className="h-1 bg-white rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                hidden
              />
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={regenCount >= 2}
            >
              Regenerar ({regenCount}/2)
            </Button>
            <Button onClick={handleAccept}>Aceptar y guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
