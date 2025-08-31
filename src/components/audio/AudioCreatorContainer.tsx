"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
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
import { Play, Pause, Loader2 } from "lucide-react";

import useSubscriptionGate from "@/hooks/useSubscriptionGate"; // 👈 añadido
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal"; // 👈 añadido

export default function AudioCreatorContainer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultText = searchParams.get("text") || "";
  const form = useAudioForm(defaultText);

  const [audioUrl, setAudioUrl] = useState("");
  const [audioId, setAudioId] = useState("");
  const [regenCount, setRegenCount] = useState(0);
  const [showModal, setShowModal] = useState(false);

  // 🎵 Control de audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const { ensureSubscribed } = useSubscriptionGate(); // 👈 hook
  const [showCheckout, setShowCheckout] = useState(false); // 👈 estado modal checkout

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn("No se pudo reproducir:", err);
      });
    }
  }, [isPlaying]);

  // 🔹 Actualizar progreso fluido con requestAnimationFrame
  useEffect(() => {
    let rafId: number;
    const updateProgress = () => {
      if (audioRef.current) {
        const el = audioRef.current;
        const p = el.currentTime;
        setProgress(p || 0);
        rafId = requestAnimationFrame(updateProgress);
      }
    };

    if (isPlaying) {
      rafId = requestAnimationFrame(updateProgress);
    }
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "00:00";
    const m = Math.floor(time / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
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
    const ok = await ensureSubscribed({ feature: "audio" }); // 👈 check
    if (!ok) {
      setShowCheckout(true); // 👈 abre modal
      return;
    }

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
      setAudioId(data.audioId);
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
    const ok = await ensureSubscribed({ feature: "audio" }); // 👈 check también aquí
    if (!ok) {
      setShowCheckout(true);
      return;
    }

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
          parentAudioId: audioId,
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
        <DialogContent className="max-w-md space-y-4">
          <DialogHeader>
            <DialogTitle>🎧 Audio generado</DialogTitle>
          </DialogHeader>

          {audioUrl && (
            <div className="bg-neutral-900 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pausar audio" : "Reproducir audio"}
                  className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white transition"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  <div className="w-full h-1 bg-neutral-700 rounded-full">
                    <div
                      className="h-1 bg-white rounded-full transition-all"
                      style={{
                        width: duration
                          ? `${(progress / duration) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                </div>
              </div>

              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
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
              {form.loading && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Regenerar ({regenCount}/2)
            </Button>
            <Button onClick={handleAccept}>Aceptar y guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal paywall */}
      <CheckoutRedirectModal
                  open={showCheckout}
                  onClose={() => setShowCheckout(false)}
                  plan="ACCESS" // 👈 el plan que quieras promocionar por defecto
                  message="Para clonar tu voz necesitas suscripción activa, empieza tu prueba GRATUITA de 7 días"
                />
    </>
  );
}
