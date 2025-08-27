"use client";

import { useState } from "react";
import { flushSync } from "react-dom"; 
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

  const handleGenerateClick = async () => {
    flushSync(() => {
      setProcessing(true);
    });

    const ok = await ensureSubscribed({ feature: "audio" });
    if (!ok) {
      toast.error("Necesitas una suscripción activa para generar audios.");
      setProcessing(false);
      return;
    }

    if (!text.trim()) {
      toast.error("⚠️ Debes escribir un texto para convertirlo en audio.");
      setProcessing(false);
      return;
    }

    if (!voiceId) {
      toast.error("⚠️ Selecciona una voz para continuar.");
      setProcessing(false);
      return;
    }

    if (!languageCode) {
      toast.error("⚠️ Selecciona un idioma para el audio.");
      setProcessing(false);
      return;
    }

    try {
      await onGenerate();
    } finally {
      setProcessing(false);
    }
  };

  const isLoading = processing || loading;
  const buttonText = processing
    ? "Procesando..."
    : loading
    ? "Generando audio..."
    : "Generar audio";

  return (
    <TooltipProvider>
      <div className="w-full max-w-2xl mx-auto rounded-2xl space-y-6">
        {/* Título */}
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
              <div>
                <div className="flex justify-between text-sm font-medium">
                  <Label>Estabilidad</Label>
                  <span>{stability.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  value={[stability]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => setStability(v[0])}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Consistencia de la voz. Más alto = más estable y menos variación.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <div className="flex justify-between text-sm font-medium">
                  <Label>Similaridad</Label>
                  <span>{similarityBoost.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  value={[similarityBoost]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => setSimilarityBoost(v[0])}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Qué tan parecido suena el resultado a tu voz original.</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <div className="flex justify-between text-sm font-medium">
                  <Label>Estilo</Label>
                  <span>{style.toFixed(2)} / 1.00</span>
                </div>
                <Slider
                  value={[style]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => setStyle(v[0])}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ajusta la expresividad de la voz (0 = plano, 1 = expresivo).</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <div className="flex justify-between text-sm font-medium">
                  <Label>Velocidad</Label>
                  <span>{speed.toFixed(2)} / 2.00</span>
                </div>
                <Slider
                  value={[speed]}
                  min={0.5}
                  max={2.0}
                  step={0.01}
                  onValueChange={(v) => setSpeed(v[0])}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Rapidez de la locución (0.5x lento, 2x muy rápido).</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Checkbox Speaker Boost */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={speakerBoost}
                onCheckedChange={(c) => setSpeakerBoost(!!c)}
              />
              <Label>Usar Speaker Boost</Label>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Mejora la claridad y potencia de la voz automáticamente.</p>
          </TooltipContent>
        </Tooltip>

        {/* Botón */}
        <Button
          onClick={handleGenerateClick}
          disabled={isLoading}
          className="w-full rounded-lg"
        >
          {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          {buttonText}
        </Button>
      </div>
    </TooltipProvider>
  );
}
