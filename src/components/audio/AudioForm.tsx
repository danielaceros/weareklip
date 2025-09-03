// src/components/audio/AudioForm.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
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

// ✅ Centralizado (mismo que usa AudioCreatorContainer)
import {
  estimateTtsSeconds,
  MAX_AUDIO_SECONDS as MAX_SEC,
  wordCount,
  maxWordsFor,
} from "@/lib/limits";

interface Voice {
  id: string;
  name: string;
}

interface AudioFormProps {
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
  const { ensureSubscribed } = useSubscriptionGate();
  const [processing, setProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const isLoading = processing || loading;

  // 🧮 Estimación y métricas (dinámicas por idioma + velocidad)
  const words = useMemo(() => wordCount(text), [text]);
  const estSeconds = useMemo(
    () => estimateTtsSeconds(text, languageCode, speed),
    [text, languageCode, speed]
  );
  const maxWords = useMemo(
    () => maxWordsFor(languageCode, speed),
    [languageCode, speed]
  );
  const tooLong = estSeconds > MAX_SEC || words > maxWords;
  const overWords = Math.max(0, words - maxWords);

  const buttonText = useMemo(
    () => (processing ? "Procesando..." : loading ? "Generando audio..." : "Generar audio"),
    [processing, loading]
  );

  const handleGenerateClick = async () => {
    setProcessing(true);

    const ok = await ensureSubscribed({ feature: "audio" });
    if (!ok) {
      setShowCheckout(true);
      setProcessing(false);
      return;
    }

    if (!text.trim() || !voiceId || !languageCode) {
      toast.error("⚠️ Completa todos los campos obligatorios.");
      setProcessing(false);
      return;
    }

    // ⛔️ Tope duro en UI (60 s)
    if (tooLong) {
      toast.error(
        `El texto supera 60s (~${Math.round(estSeconds)}s). ` +
          `A ${speed.toFixed(2)}x y “${languageCode}” caben ~${maxWords} palabras; ` +
          (overWords > 0 ? `te pasas en ${overWords}.` : "acorta el texto o sube la velocidad.")
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

  // Handlers sliders
  const handleStability = useCallback((v: number[]) => setStability(v[0]), [setStability]);
  const handleSimilarity = useCallback((v: number[]) => setSimilarityBoost(v[0]), [setSimilarityBoost]);
  const handleStyle = useCallback((v: number[]) => setStyle(v[0]), [setStyle]);
  const handleSpeed = useCallback((v: number[]) => setSpeed(v[0]), [setSpeed]);

  const disableButton = !text.trim() || !voiceId || !languageCode || isLoading || tooLong;

  return (
    <TooltipProvider>
      <div className="w-full max-w-2xl mx-auto rounded-2xl space-y-6">
        <h2 className="text-xl font-semibold">Generación de audio</h2>

        {/* Texto */}
        <div>
          <Label className="text-sm font-medium">Texto *</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe el texto..."
            className="mt-2"
          />
          {/* Indicadores */}
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">
              Palabras: {words} / ≈{maxWords} · Estimación: ~{Math.max(0, Math.round(estSeconds))}s / {MAX_SEC}s
            </span>
            {tooLong && (
              <span className="text-destructive ml-2">
                {overWords > 0
                  ? `Reduce ${overWords} palabra${overWords === 1 ? "" : "s"} o incrementa la velocidad.`
                  : "Reduce el texto o incrementa la velocidad."}
              </span>
            )}
          </div>
        </div>

        {/* Voz + Idioma */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Voz *</Label>
            <Select onValueChange={setVoiceId} value={voiceId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Seleccionar una voz" />
              </SelectTrigger>
              <SelectContent>
                {voices.length > 0 ? (
                  voices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-voices" disabled>
                    No tienes voces guardadas
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Idioma *</Label>
            <Select onValueChange={setLanguageCode} value={languageCode}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Seleccionar un idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">Inglés</SelectItem>
                <SelectItem value="fr">Francés</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <label htmlFor="stability-slider">
                <div className="flex justify-between text-sm font-medium">
                  <span>Estabilidad</span>
                  <span>{stability.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  id="stability-slider"
                  aria-label="Control de estabilidad"
                  value={[stability]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleStability}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Consistencia de la voz. Más alto = más estable y menos variación.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <label htmlFor="similarity-slider">
                <div className="flex justify-between text-sm font-medium">
                  <span>Similaridad</span>
                  <span>{similarityBoost.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  id="similarity-slider"
                  aria-label="Control de similaridad"
                  value={[similarityBoost]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleSimilarity}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Qué tan parecido suena el resultado a tu voz original.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <label htmlFor="style-slider">
                <div className="flex justify-between text-sm font-medium">
                  <span>Estilo</span>
                  <span>{style.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  id="style-slider"
                  aria-label="Control de estilo"
                  value={[style]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={handleStyle}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ajusta la expresividad de la voz (0 = plano, 1 = expresivo).</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <label htmlFor="speed-slider">
                <div className="flex justify-between text-sm font-medium">
                  <span>Velocidad</span>
                  <span>{speed.toFixed(2)} / 2.00</span>
                </div>
                <Slider
                  id="speed-slider"
                  aria-label="Control de velocidad"
                  value={[speed]}
                  min={0.5}
                  max={2.0}
                  step={0.01}
                  onValueChange={handleSpeed}
                />
              </label>
            </TooltipTrigger>
            <TooltipContent>
              <p>Rapidez de la locución (0.5x lento, 2x muy rápido).</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Speaker Boost */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Checkbox
                id="speaker-boost"
                checked={speakerBoost}
                onCheckedChange={(c) => setSpeakerBoost(!!c)}
                aria-label="Activar Speaker Boost"
              />
              <Label htmlFor="speaker-boost">Usar Speaker Boost</Label>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Mejora la claridad y potencia de la voz automáticamente.</p>
          </TooltipContent>
        </Tooltip>

        {/* Botón */}
        <Button
          onClick={handleGenerateClick}
          disabled={disableButton}
          className="w-full rounded-lg"
        >
          {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          {tooLong ? "Texto supera 60s" : buttonText}
        </Button>
      </div>

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Necesitas una suscripción activa para generar audios."
      />
    </TooltipProvider>
  );
}
