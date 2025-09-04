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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Play, Pause, Loader2 } from "lucide-react";
import type { AudioData } from "@/components/audio/AudiosList";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

const MAX_SEC = 60;
const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const estimateTtsSeconds = (text: string) => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words / 2.5;
};

interface Props {
  onCreated?: (audio: AudioData) => void;
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

  // 🎵 player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // 🏷️ título del audio (persistirá en Firestore vía create)
  const [title, setTitle] = useState("");

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => {});
  }, [isPlaying]);

  // RAF progreso
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

  useEffect(() => {
    if (duration > MAX_SEC) {
      toast.error(
        `⏱️ El audio dura ${formatTime(
          duration
        )} y el máximo permitido es ${MAX_SEC}s.`
      );
    }
  }, [duration]);

  const buildVoiceSettings = (overrides?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    speed?: number;
    use_speaker_boost?: boolean;
  }) => {
    const rawSpeed = overrides?.speed ?? form.speed ?? 1;
    const safeSpeed = clamp(rawSpeed, MIN_SPEED, MAX_SPEED);
    return {
      stability: overrides?.stability ?? form.stability ?? null,
      similarity_boost:
        overrides?.similarity_boost ?? form.similarityBoost ?? null,
      style: overrides?.style ?? form.style ?? null,
      speed: safeSpeed,
      use_speaker_boost:
        overrides?.use_speaker_boost ?? form.speakerBoost ?? null,
    };
  };

  // 👉 Generar audio
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
          // ⬇️ enviamos el nombre para persistirlo en Firestore
          name: title?.trim() || undefined,
          title: title?.trim() || undefined,
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

  // 🔄 abrir diálogo de regeneración
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenText, setRegenText] = useState("");
  const [regenVoiceId, setRegenVoiceId] = useState("");
  const [regenStability, setRegenStability] = useState(0.5);
  const [regenSimilarityBoost, setRegenSimilarityBoost] = useState(0.75);
  const [regenStyle, setRegenStyle] = useState(0);
  const [regenSpeed, setRegenSpeed] = useState(1);
  const [regenSpeakerBoost, setRegenSpeakerBoost] = useState(true);

  const { ensureSubscribed } = useSubscriptionGate();
  const [showCheckout, setShowCheckout] = useState(false);

  const openRegenDialog = () => {
    if (regenCount >= 2) {
      toast.error("⚠️ Ya has regenerado el audio 2 veces.");
      return;
    }
    setRegenText(form.text);
    setRegenVoiceId(form.voiceId);
    setRegenStability(form.stability);
    setRegenSimilarityBoost(form.similarityBoost);
    setRegenStyle(form.style);
    setRegenSpeed(clamp(form.speed, MIN_SPEED, MAX_SPEED));
    setRegenSpeakerBoost(form.speakerBoost);
    setRegenDialogOpen(true);
  };

  const handleRegenerate = async (overrides?: {
    text?: string;
    voiceId?: string;
    stability?: number;
    similarity_boost?: number;
    style?: number;
    speed?: number;
    use_speaker_boost?: boolean;
  }) => {
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

    const textToUse = overrides?.text ?? form.text;
    const voiceToUse = overrides?.voiceId ?? form.voiceId;

    const est = estimateTtsSeconds(textToUse);
    if (est > MAX_SEC) {
      toast.error(
        `⏱️ El texto es demasiado largo (~${Math.round(
          est
        )}s). Máximo ${MAX_SEC}s.`
      );
      return;
    }

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
          text: textToUse,
          voiceId: voiceToUse,
          voice_settings: buildVoiceSettings(overrides),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error regenerando audio");

      setAudioUrl(data.audioUrl);
      setRegenCount((c) => c + 1);

      if (overrides?.text) form.setText(overrides.text);
      if (overrides?.voiceId) form.setVoiceId(overrides.voiceId);
      if (overrides?.stability !== undefined)
        form.setStability(overrides.stability);
      if (overrides?.similarity_boost !== undefined)
        form.setSimilarityBoost(overrides.similarity_boost);
      if (overrides?.style !== undefined) form.setStyle(overrides.style);
      if (overrides?.speed !== undefined)
        form.setSpeed(clamp(overrides.speed, MIN_SPEED, MAX_SPEED));
      if (overrides?.use_speaker_boost !== undefined)
        form.setSpeakerBoost(overrides.use_speaker_boost);

      toast.success(`✅ Audio regenerado (${Math.min(regenCount + 1, 2)}/2)`, {
        id: loadingId,
      });
    } catch (err) {
      console.error("❌ handleRegenerate error:", err);
      toast.error("❌ No se pudo regenerar", { id: loadingId });
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const finishAndRefresh = useCallback(() => {
    setShowModal(false);
    if (onCreated) return;
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

    const finalName = (title || "").trim() || form.text.slice(0, 30) + "...";

    const optimisticAudio: AudioData = {
      audioId: audioId || uuidv4(),
      url: audioUrl,
      name: finalName, // la tarjeta verá este nombre
      description: form.text,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      duration,
      language: "es",
    };

    if (onCreated) onCreated(optimisticAudio);

    toast.success("📂 Audio guardado en tu biblioteca");
    finishAndRefresh();
  };

  return (
    <>
      {/* Pasamos title para que el formulario muestre el input */}
      <AudioForm
        {...form}
        title={title}
        setTitle={setTitle}
        onGenerate={handleGenerate}
      />

      {/* Preview modal */}
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
              onClick={openRegenDialog}
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

      {/* Regen dialog (sin cambios visuales) */}
      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modificar parámetros antes de regenerar</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="regen-text">Texto *</Label>
              <Textarea
                id="regen-text"
                value={regenText}
                onChange={(e) => setRegenText(e.target.value)}
                placeholder="Escribe el texto a convertir en audio"
                className="min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="regen-voice">Voz *</Label>
                <Select value={regenVoiceId} onValueChange={setRegenVoiceId}>
                  <SelectTrigger id="regen-voice">
                    <SelectValue placeholder="Selecciona una voz" />
                  </SelectTrigger>
                  <SelectContent>
                    {form.voices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Idioma</Label>
                <Select defaultValue="es" disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <Label>Estabilidad</Label>
                  <span className="text-sm text-muted-foreground">
                    {regenStability.toFixed(2)} / 1.00
                  </span>
                </div>
                <Slider
                  value={[regenStability]}
                  onValueChange={([v]) => setRegenStability(v)}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <Label>Similaridad</Label>
                  <span className="text-sm text-muted-foreground">
                    {regenSimilarityBoost.toFixed(2)} / 1.00
                  </span>
                </div>
                <Slider
                  value={[regenSimilarityBoost]}
                  onValueChange={([v]) => setRegenSimilarityBoost(v)}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <Label>Estilo</Label>
                  <span className="text-sm text-muted-foreground">
                    {regenStyle.toFixed(2)} / 1.00
                  </span>
                </div>
                <Slider
                  value={[regenStyle]}
                  onValueChange={([v]) => setRegenStyle(v)}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <Label>Velocidad</Label>
                  <span className="text-sm text-muted-foreground">
                    {regenSpeed.toFixed(2)} / {MAX_SPEED.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[regenSpeed]}
                  onValueChange={([v]) =>
                    setRegenSpeed(clamp(v, MIN_SPEED, MAX_SPEED))
                  }
                  min={MIN_SPEED}
                  max={MAX_SPEED}
                  step={0.01}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="regen-speaker-boost"
                  checked={regenSpeakerBoost}
                  onCheckedChange={(checked) => setRegenSpeakerBoost(!!checked)}
                />
                <Label htmlFor="regen-speaker-boost" className="cursor-pointer">
                  Usar Speaker Boost
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!regenText.trim()) {
                  toast.error("El texto no puede estar vacío");
                  return;
                }
                if (!regenVoiceId) {
                  toast.error("Debes seleccionar una voz");
                  return;
                }

                setRegenDialogOpen(false);
                await handleRegenerate({
                  text: regenText,
                  voiceId: regenVoiceId,
                  stability: regenStability,
                  similarity_boost: regenSimilarityBoost,
                  style: regenStyle,
                  speed: regenSpeed,
                  use_speaker_boost: regenSpeakerBoost,
                });
              }}
            >
              Aceptar y regenerar
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
