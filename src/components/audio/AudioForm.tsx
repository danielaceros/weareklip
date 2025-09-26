"use client";

import { useState, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

// ✅ i18n
import { useTranslations } from "next-intl";

interface Voice {
  id: string;
  name: string;
}

interface AudioFormProps {
  title?: string;
  setTitle?: (v: string) => void;

  text: string;
  setText: (val: string) => void;
  voices: Voice[];
  voiceId: string;
  setVoiceId: (val: string) => void;
  languageCode: string;
  setLanguageCode: (val: string) => void;
  stability: number;
  setStability: (val: number) => void;
  similarityBoost: number;
  setSimilarityBoost: (val: number) => void;
  style: number;
  setStyle: (val: number) => void;
  speed: number;
  setSpeed: (val: number) => void;
  speakerBoost: boolean;
  setSpeakerBoost: (val: boolean) => void;
  onGenerate: () => void | Promise<void>;
  loading: boolean;
}

export function AudioForm({
  title,
  setTitle,
  text,
  setText,
  voices,
  voiceId,
  setVoiceId,
  languageCode,
  setLanguageCode,
  stability,
  setStability,
  similarityBoost,
  setSimilarityBoost,
  style,
  setStyle,
  speed,
  setSpeed,
  speakerBoost,
  setSpeakerBoost,
  onGenerate,
  loading,
}: AudioFormProps) {
  const t = useTranslations();
  const { ensureSubscribed } = useSubscriptionGate();
  const [processing, setProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const isLoading = processing || loading;

  const buttonText = useMemo(() => {
    if (processing) return t("audioForm.buttons.processing");
    if (loading) return t("audioForm.buttons.generating");
    return t("audioForm.buttons.generate");
  }, [processing, loading, t]);

  const handleGenerateClick = async () => {
    setProcessing(true);

    const ok = await ensureSubscribed({ feature: "audio" });
    if (!ok) {
      setShowCheckout(true);
      setProcessing(false);
      return;
    }

    if (!text.trim() || !voiceId || !languageCode) {
      toast.error(t("audioForm.toasts.fillAll"));
      setProcessing(false);
      return;
    }

    try {
      await onGenerate();
    } finally {
      setProcessing(false);
    }
  };

  const handleStability = useCallback(
    (v: number[]) => setStability(v[0]),
    [setStability]
  );
  const handleSimilarity = useCallback(
    (v: number[]) => setSimilarityBoost(v[0]),
    [setSimilarityBoost]
  );
  const handleStyle = useCallback((v: number[]) => setStyle(v[0]), [setStyle]);
  const handleSpeed = useCallback((v: number[]) => setSpeed(v[0]), [setSpeed]);

  const disableButton = !text.trim() || !voiceId || !languageCode || isLoading;

  return (
    <TooltipProvider>
      <div className="w-full max-w-2xl mx-auto rounded-2xl space-y-6">
        <h2 className="text-xl font-semibold">
          {t("audioForm.title")}
        </h2>

        {/* Título opcional */}
        {typeof title === "string" && typeof setTitle === "function" && (
          <div>
            <Label className="text-sm font-medium" htmlFor="audio-title">
              {t("audioForm.labels.nameOptional")}
            </Label>
            <Input
              id="audio-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("audioForm.placeholders.name")}
              className="mt-2"
              maxLength={80}
            />
          </div>
        )}

        {/* Texto */}
        <div>
          <Label className="text-sm font-medium" htmlFor="audio-text">
            {t("audioForm.labels.text")}
          </Label>
          <Textarea
            id="audio-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("audioForm.placeholders.text")}
            className="mt-2 min-h-[120px]"
          />
        </div>

        {/* Voz / Idioma */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">
              {t("audioForm.labels.voice")}
            </Label>
            <Select value={voiceId} onValueChange={setVoiceId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder={t("audioForm.placeholders.voice")} />
              </SelectTrigger>
              <SelectContent>
                {voices.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">
              {t("audioForm.labels.language")}
            </Label>
            <Select value={languageCode} onValueChange={setLanguageCode}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <label htmlFor="stability">
                <div className="flex justify-between text-sm font-medium">
                  <span>{t("audioForm.labels.stability")}</span>
                  <span>{stability.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  id="stability"
                  value={[stability]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleStability}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("audioForm.tooltips.stability")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <label htmlFor="similarity">
                <div className="flex justify-between text-sm font-medium">
                  <span>{t("audioForm.labels.similarity")}</span>
                  <span>{similarityBoost.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  id="similarity"
                  value={[similarityBoost]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleSimilarity}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("audioForm.tooltips.similarity")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <label htmlFor="style">
                <div className="flex justify-between text-sm font-medium">
                  <span>{t("audioForm.labels.style")}</span>
                  <span>{style.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  id="style"
                  value={[style]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleStyle}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("audioForm.tooltips.style")}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <label htmlFor="speed">
                <div className="flex justify-between text-sm font-medium">
                  <span>{t("audioForm.labels.speed")}</span>
                  <span>{speed.toFixed(2)} / 2.00</span>
                </div>
                <Slider
                  id="speed"
                  value={[speed]}
                  min={0.5}
                  max={2.0}
                  step={0.01}
                  onValueChange={handleSpeed}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("audioForm.tooltips.speed")}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Speaker Boost */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="speaker-boost"
            checked={speakerBoost}
            onCheckedChange={(c) => setSpeakerBoost(!!c)}
          />
          <Label htmlFor="speaker-boost">
            {t("audioForm.labels.speakerBoost")}
          </Label>
        </div>

        <Button
          onClick={handleGenerateClick}
          disabled={disableButton}
          className="w-full rounded-lg"
        >
          {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          {buttonText}
        </Button>
      </div>

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message={t("audioForm.checkout.message")}
      />
    </TooltipProvider>
  );
}
