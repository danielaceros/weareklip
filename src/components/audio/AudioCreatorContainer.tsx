// src/components/audio/AudioCreatorContainer.tsx
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

import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

const MAX_SEC = 60;

// Lectura aproximada para TTS ~150 wpm => 2.5 palabras/seg
const estimateTtsSeconds = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words / 2.5;
};

interface Props {
  /** Permite al padre cerrar su modal y refrescar lista al guardar */
  onCreated?: () => void;
  /** (añadido) Permite que el padre pase onCancel sin error de tipos */
  onCancel?: () => void;
}

export default function AudioCreatorContainer({ onCreated }: Props) {
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

  const { ensureSubscribed } = useSubscriptionGate();
  const [showCheckout, setShowCheckout] = useState(false);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
  }, [isPlaying]);

  // Actualizar progreso con rAF
  useEffect(() => {
    let rafId: number;
    const loop = () => {
      if (audioRef.current) setProgress(audioRef.current.currentTime || 0);
      rafId = requestAnimationFrame(loop);
    };
    if (isPlaying) rafId = requestAnimationFrame(loop);
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

  // Avisar si el audio generado excede 60s
  useEffect(() => {
    if (duration > MAX_SEC) {
      toast.error(
        `⏱️ El audio dura ${formatTime(
          duration
        )} y el máximo permitido es ${MAX_SEC}s. Acorta el texto o la velocidad.`
      );
    }
  }, [duration]);

  const buildVoiceSettings = () => ({
    stability: form.stability ?? null,
    similarity_boost: form.similarityBoost ?? null,
    style: form.style ?? null,
    speed: form.speed ?? null,
    use_speaker_boost: form.speakerBoost ?? null,
  });

  // 👉 Generar audio inicial
  const handleGenerate = async () => {
    const ok = await ensureSubscribed({ feature: "audio" });
    if (!ok) {
      setShowCheckout(true);
      return;
    }

    if (!form.text.trim()) {
      toast.error("Debes escribir el texto a convertir.");
      return;
    }
    // Estimación previa
    const est = estimateTtsSeconds(form.text);
    if (est > MAX_SEC) {
      toast.error(
        `⏱️ El texto es demasiado largo (~${Math.round(
          est
        )}s). Máximo ${MAX_SEC}s.`
      );
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
    const ok = await ensureSubscribed({ feature: "audio" });
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
    // Estimar de nuevo por si cambió el texto
    const est = estimateTtsSeconds(form.text);
    if (est > MAX_SEC) {
      toast.error(
        `⏱️ El texto es demasiado largo (~${Math.round(
          est
        )}s). Máximo ${MAX_SEC}s.`
      );
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

  // 👇 Cerrar modal de preview + cerrar modal padre (si hay) + refrescar lista
  const finishAndRefresh = useCallback(() => {
    setShowModal(false);

    // 1) Si el padre nos pasó onCreated, lo usamos (cierra modal padre y refresca lista allí)
    if (onCreated) {
      onCreated();
      return;
    }

    // 2) Fallback universal: forzar una navegación "diferente" para refrescar la página/lista
    //    Esto cierra el modal padre controlado por la ruta y dispara tus efectos de carga.
    const stamp = Date.now();
    router.push(`/dashboard/audio?created=${stamp}`);
  }, [onCreated, router]);

  const handleAccept = () => {
    if (duration > MAX_SEC) {
      toast.error(
        `⏱️ El audio dura ${formatTime(
          duration
        )} (> ${MAX_SEC}s). Por favor, acórtalo antes de guardar.`
      );
      return;
    }

    toast.success("📂 Audio guardado en tu biblioteca");
    finishAndRefresh();
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
            <Button onClick={handleAccept} disabled={duration > MAX_SEC}>
              Aceptar y guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Para clonar tu voz necesitas suscripción activa, empieza tu prueba GRATUITA de 7 días"
      />
    </>
  );
}
