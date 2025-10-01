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

/** ================== LÍMITES Y ESTIMACIÓN ================== */
type Locale = "es" | "en" | "fr";
const MAX_SEC = 60;
const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;

const BASE_WPM: Record<Locale, number> = {
  es: 160,
  en: 170,
  fr: 150,
};

const PAUSE_SECONDS = {
  comma: 0.25,
  period: 0.6,
  newline: 0.6,
  colonSemicolon: 0.35,
};

// pausa media muy conservadora (~1 pausa/15 palabras ≈ 0.25 s)
const AVG_PAUSE_PER_WORD = 0.25 / 15;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const normalizeLocale = (lang?: string): Locale =>
  (["es", "en", "fr"].includes(String(lang)) ? (lang as Locale) : "es");

const countWords = (text: string) => {
  const cleaned = text.replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
};

const countPauses = (text: string) => {
  const commas = (text.match(/,/g) || []).length;
  const periods = (text.match(/[.!?]/g) || []).length;
  const colons = (text.match(/[:;]/g) || []).length;
  const newlines = (text.match(/\n/g) || []).length;
  return (
    commas * PAUSE_SECONDS.comma +
    periods * PAUSE_SECONDS.period +
    colons * PAUSE_SECONDS.colonSemicolon +
    newlines * PAUSE_SECONDS.newline
  );
};

const estimateSpeechSeconds = (text: string, locale: Locale, speed: number) => {
  const words = countWords(text);
  const pauses = countPauses(text);
  const wpm = Math.max(1, BASE_WPM[locale] * Math.max(0.1, speed));
  const speech = (words / wpm) * 60;
  return { seconds: speech + pauses, words, wpm, pauses };
};

const maxWordsFor = (maxSec: number, locale: Locale, speed: number) => {
  const wpm = Math.max(1, BASE_WPM[locale] * Math.max(0.1, speed));
  const secPerWord = 60 / wpm + AVG_PAUSE_PER_WORD;
  return Math.max(0, Math.floor(maxSec / secPerWord));
};

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

  // ===== Estimación en tiempo real (texto + idioma + velocidad) =====
  const locale = normalizeLocale(languageCode || "es");
  const safeSpeed = clamp(speed ?? 1, MIN_SPEED, MAX_SPEED);

  const { estSeconds, wordCount, budgetWords, overBudget } = useMemo(() => {
    const budget = maxWordsFor(MAX_SEC, locale, safeSpeed);
    const est = estimateSpeechSeconds(text || "", locale, safeSpeed);
    return {
      estSeconds: est.seconds,
      wordCount: est.words,
      budgetWords: budget,
      overBudget: est.seconds > MAX_SEC,
    };
  }, [text, locale, safeSpeed]);

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

    if (overBudget) {
      // Se volverá a validar también en el contenedor, pero aquí prevenimos ya.
      toast.error(
        t("audioCreator.toasts.textTooLongEst", {
          seconds: Math.round(estSeconds),
          max: MAX_SEC,
        })
      );
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
  const handleSpeed = useCallback(
    (v: number[]) => setSpeed(clamp(v[0], MIN_SPEED, MAX_SPEED)),
    [setSpeed]
  );

  const disableButton =
    !text.trim() || !voiceId || !languageCode || isLoading || overBudget;

  return (
    <TooltipProvider>
      <div className="w-full max-w-2xl mx-auto rounded-2xl space-y-6">
        <h2 className="text-xl font-semibold">{t("audioForm.title")}</h2>

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
            aria-invalid={overBudget ? true : undefined}
          />
          {/* Indicadores de presupuesto */}
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t("common.counter", { count: wordCount, max: budgetWords })}
            </span>
            <span className={overBudget ? "text-destructive font-medium" : "text-muted-foreground"}>
              {Math.ceil(estSeconds)}s / {MAX_SEC}s
            </span>
          </div>
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
                {/* Si más adelante añadís EN/FR en UI, el estimador ya está listo */}
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
                  <span>{safeSpeed.toFixed(2)} / {MAX_SPEED.toFixed(2)}</span>
                </div>
                <Slider
                  id="speed"
                  value={[safeSpeed]}
                  min={MIN_SPEED}
                  max={MAX_SPEED}
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
