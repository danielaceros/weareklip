"use client";

import { useState, useCallback, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import { toast } from "sonner";

interface ScriptFormProps {
  description: string;
  tone: string;
  platform: string;
  duration: string;
  language: string;
  structure: string;
  addCTA: boolean;
  ctaText: string;
  loading: boolean; // viene del padre
  setDescription: (val: string) => void;
  setTone: (val: string) => void;
  setPlatform: (val: string) => void;
  setDuration: (val: string) => void;
  setLanguage: (val: string) => void;
  setStructure: (val: string) => void;
  setAddCTA: (val: boolean) => void;
  setCtaText: (val: string) => void;
  onSubmit: () => void | Promise<void>;
}

export function ScriptForm({
  description,
  tone,
  platform,
  duration,
  language,
  structure,
  addCTA,
  ctaText,
  loading,
  setDescription,
  setTone,
  setPlatform,
  setDuration,
  setLanguage,
  setStructure,
  setAddCTA,
  setCtaText,
  onSubmit,
}: ScriptFormProps) {
  const { ensureSubscribed } = useSubscriptionGate();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = useCallback(async () => {
    flushSync(() => {
      setProcessing(true);
    });

    const ok = await ensureSubscribed({ feature: "script" });
    if (!ok) {
      toast.error("Necesitas una suscripción activa para generar guiones.");
      setProcessing(false);
      return;
    }

    if (!description || !tone || !platform || !duration || !structure) {
      toast.error("⚠️ Por favor, completa todos los campos obligatorios.");
      setProcessing(false);
      return;
    }

    try {
      await onSubmit();
    } finally {
      setProcessing(false);
    }
  }, [
    ensureSubscribed,
    description,
    tone,
    platform,
    duration,
    structure,
    onSubmit,
  ]);

  const isLoading = processing || loading;
  const buttonText = processing
    ? "Procesando..."
    : loading
    ? "Generando..."
    : "Generar guion";

  // ✅ Memoizar las opciones de Select para evitar recreación
  const toneOptions = useMemo(
    () => [
      { value: "motivador", label: "Motivador" },
      { value: "educativo", label: "Educativo" },
      { value: "humoristico", label: "Humorístico" },
      { value: "serio", label: "Serio" },
      { value: "inspirador", label: "Inspirador" },
      { value: "emocional", label: "Emocional" },
      { value: "provocador", label: "Provocador" },
    ],
    []
  );

  const platformOptions = useMemo(
    () => [
      { value: "instagram", label: "Instagram" },
      { value: "tiktok", label: "TikTok" },
      { value: "youtube", label: "YouTube Shorts" },
      { value: "linkedin", label: "LinkedIn" },
    ],
    []
  );

  const durationOptions = useMemo(
    () => [
      { value: "15-30", label: "15–30 segundos" },
      { value: "30-45", label: "30–45 segundos" },
      { value: "45-60", label: "45–60 segundos" },
      { value: "60-90", label: "60–90 segundos" },
    ],
    []
  );

  const languageOptions = useMemo(
    () => [
      { value: "es", label: "Español" },
      { value: "en", label: "Inglés" },
      { value: "fr", label: "Francés" },
    ],
    []
  );

  const structureOptions = useMemo(
    () => [
      { value: "gancho-desarrollo-cierre", label: "Gancho – Desarrollo – Cierre" },
      { value: "storytelling", label: "Storytelling" },
      { value: "lista-tips", label: "Lista de tips" },
      { value: "pregunta-retorica", label: "Pregunta retórica" },
      { value: "comparativa-antes-despues", label: "Comparativa antes/después" },
      { value: "mito-vs-realidad", label: "Mito vs realidad" },
      { value: "problema-solucion", label: "Problema – Solución" },
      { value: "testimonio", label: "Testimonio" },
    ],
    []
  );

  return (
    <div className="w-full space-y-8">
      {/* Título */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Generación de guión</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Completa los campos para crear un nuevo guión automáticamente.
        </p>
      </header>

      {/* Formulario en dos columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Columna izquierda */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Descripción breve *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Reel motivador sobre productividad para emprendedores"
              className="min-h-[120px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Tono *</Label>
            <Select onValueChange={setTone} defaultValue={tone}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar un tono" />
              </SelectTrigger>
              <SelectContent>
                {toneOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Plataforma *</Label>
            <Select onValueChange={setPlatform} defaultValue={platform}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar una plataforma" />
              </SelectTrigger>
              <SelectContent>
                {platformOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Duración *</Label>
            <Select onValueChange={setDuration} defaultValue={duration}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar una duración" />
              </SelectTrigger>
              <SelectContent>
                {durationOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Idioma *</Label>
            <Select onValueChange={setLanguage} defaultValue={language || "es"}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar un idioma" />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estructura *</Label>
            <Select onValueChange={setStructure} defaultValue={structure}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar una estructura" />
              </SelectTrigger>
              <SelectContent>
                {structureOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* CTA opcional */}
      <div className="pt-2 space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox checked={addCTA} onCheckedChange={(c) => setAddCTA(!!c)} />
          <Label>Añadir llamada a la acción (CTA)</Label>
        </div>
        {addCTA && (
          <Input
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder="Ej: Sígueme para más consejos"
          />
        )}
      </div>

      {/* Botón */}
      <div className="pt-4">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading}
          aria-busy={isLoading}
          aria-disabled={isLoading}
          className="w-full"
          data-paywall
          data-paywall-feature="script"
        >
          {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
