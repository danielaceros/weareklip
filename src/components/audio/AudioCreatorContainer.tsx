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

// ✅ i18n
import { useTranslations } from "next-intl";

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
  const t = useTranslations();
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

  // 🏷️ título del audio (persistirá)
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
        t("audioCreator.toasts.durationExceeded", {
          duration: formatTime(duration),
          max: MAX_SEC,
        })
      );
    }
  }, [duration, t]);

  const clampSpeed = (v: number) => clamp(v, MIN_SPEED, MAX_SPEED);

  const buildVoiceSettings = (overrides?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    speed?: number;
    use_speaker_boost?: boolean;
  }) => {
    const rawSpeed = overrides?.speed ?? form.speed ?? 1;
    const safeSpeed = clampSpeed(rawSpeed);
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
  const { ensureSubscribed } = useSubscriptionGate();
  const [showCheckout, setShowCheckout] = useState(false);

  const handleGenerate = async () => {
    const ok = await ensureSubscribed({ feature: "audio" });
    if (!ok) {
      setShowCheckout(true);
      return;
    }

    if (!form.text.trim()) {
      toast.error(t("audioCreator.toasts.enterText"));
      return;
    }
    const est = estimateTtsSeconds(form.text);
    if (est > MAX_SEC) {
      toast.error(
        t("audioCreator.toasts.textTooLongEst", {
          seconds: Math.round(est),
          max: MAX_SEC,
        })
      );
      return;
    }
    if (!form.voiceId) {
      toast.error(t("audioCreator.toasts.selectVoice"));
      return;
    }
    if (!form.user) {
      toast.error(t("audioCreator.toasts.mustLogin"));
      return;
    }

    form.setLoading(true);
    const loadingId = toast.loading(t("audioCreator.toasts.generating"));

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

      toast.success(t("audioCreator.toasts.generated"), { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error(t("audioCreator.toasts.generateError"), { id: loadingId });
    } finally {
      form.setLoading(false);
    }
  };

  // 🔄 Regeneración
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenText, setRegenText] = useState("");
  const [regenVoiceId, setRegenVoiceId] = useState("");
  const [regenStability, setRegenStability] = useState(0.5);
  const [regenSimilarityBoost, setRegenSimilarityBoost] = useState(0.75);
  const [regenStyle, setRegenStyle] = useState(0);
  const [regenSpeed, setRegenSpeed] = useState(1);
  const [regenSpeakerBoost, setRegenSpeakerBoost] = useState(true);

  const openRegenDialog = () => {
    if (regenCount >= 2) {
      toast.error(t("audioCreator.toasts.regenLimit"));
      return;
    }
    setRegenText(form.text);
    setRegenVoiceId(form.voiceId);
    setRegenStability(form.stability);
    setRegenSimilarityBoost(form.similarityBoost);
    setRegenStyle(form.style);
    setRegenSpeed(clampSpeed(form.speed));
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
      toast.error(t("audioCreator.toasts.noBaseAudio"));
      return;
    }
    if (regenCount >= 2) {
      toast.error(t("audioCreator.toasts.regenLimit"));
      return;
    }

    const textToUse = overrides?.text ?? form.text;
    const voiceToUse = overrides?.voiceId ?? form.voiceId;

    const est = estimateTtsSeconds(textToUse);
    if (est > MAX_SEC) {
      toast.error(
        t("audioCreator.toasts.textTooLongEst", {
          seconds: Math.round(est),
          max: MAX_SEC,
        })
      );
      return;
    }

    const loadingId = toast.loading(t("audioCreator.toasts.regenerating"));
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
        form.setSpeed(clampSpeed(overrides.speed));
      if (overrides?.use_speaker_boost !== undefined)
        form.setSpeakerBoost(overrides.use_speaker_boost);

      toast.success(
        t("audioCreator.toasts.regenerated"), // Mensaje genérico
        { id: loadingId }
      );
    } catch (err) {
      console.error("❌ handleRegenerate error:", err);
      toast.error(t("audioCreator.toasts.regenError"), { id: loadingId });
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
        t("audioCreator.toasts.durationExceededBeforeSave", {
          duration: formatTime(duration),
          max: MAX_SEC,
        })
      );
      return;
    }

    const finalName = (title || "").trim() || form.text.slice(0, 30) + "...";

    const optimisticAudio: AudioData = {
      audioId: audioId || uuidv4(),
      url: audioUrl,
      name: finalName,
      description: form.text,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      duration,
      language: "es",
    };

    if (onCreated) onCreated(optimisticAudio);

    toast.success(t("audioCreator.toasts.saved"));
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
            <DialogTitle>{t("audioCreator.dialog.title")}</DialogTitle>
          </DialogHeader>

          {audioUrl && (
            <div className="bg-neutral-900 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  aria-label={
                    isPlaying
                      ? t("audioCreator.player.pause")
                      : t("audioCreator.player.play")
                  }
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
                      className="h-1 rounded-full transition-all"
                      style={{
                        width: duration
                          ? `${(progress / duration) * 100}%`
                          : "0%",
                        backgroundColor: "currentColor",
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
              {t("audioCreator.buttons.regenerate", { count: regenCount })}
            </Button>
            <Button onClick={handleAccept} disabled={duration > MAX_SEC}>
              {t("audioCreator.buttons.accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regen dialog */}
      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("audioCreator.regenDialog.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="regen-text">{t("audioCreator.regenDialog.labels.text")}</Label>
              <Textarea
                id="regen-text"
                value={regenText}
                onChange={(e) => setRegenText(e.target.value)}
                placeholder={t("audioCreator.regenDialog.placeholders.text")}
                className="min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="regen-voice">{t("audioCreator.regenDialog.labels.voice")}</Label>
                <Select value={regenVoiceId} onValueChange={setRegenVoiceId}>
                  <SelectTrigger id="regen-voice">
                    <SelectValue placeholder={t("audioCreator.regenDialog.placeholders.voice")} />
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
                <Label>{t("audioCreator.regenDialog.labels.language")}</Label>
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
                  <Label>{t("audioCreator.regenDialog.labels.stability")}</Label>
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
                  <Label>{t("audioCreator.regenDialog.labels.similarity")}</Label>
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
                  <Label>{t("audioCreator.regenDialog.labels.style")}</Label>
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
                  <Label>{t("audioCreator.regenDialog.labels.speed")}</Label>
                  <span className="text-sm text-muted-foreground">
                    {regenSpeed.toFixed(2)} / {MAX_SPEED.toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[regenSpeed]}
                  onValueChange={([v]) => setRegenSpeed(clampSpeed(v))}
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
                  {t("audioCreator.regenDialog.labels.speakerBoost")}
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenDialogOpen(false)}>
              {t("audioCreator.regenDialog.actions.cancel")}
            </Button>
            <Button
              onClick={async () => {
                if (!regenText.trim()) {
                  toast.error(t("audioCreator.toasts.enterText"));
                  return;
                }
                if (!regenVoiceId) {
                  toast.error(t("audioCreator.toasts.selectVoice"));
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
              {t("audioCreator.buttons.regenerate", { count: regenCount })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message={t("audioCreator.paywall")}
      />
    </>
  );
}
