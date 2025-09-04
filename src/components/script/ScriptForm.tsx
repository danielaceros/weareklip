// src/components/script/ScriptForm.tsx
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
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

// ✅ límites centralizados (mismos que audio)
import { MAX_AUDIO_SECONDS as MAX_SEC, WPS } from "@/lib/limits";

interface ScriptFormProps {
  description: string;
  tone: string;
  platform: string;
  duration: string;      // "0-15" | "15-30" | "30-45" | "45-60"
  language: string;      // "es" | "en" | "fr"
  structure: string;
  addCTA: boolean;
  ctaText: string;
  loading: boolean;
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

// 🔎 util: parsea "15-30" -> [15, 30]
function parseDurationRange(range: string): [number, number] | null {
  const m = range.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return [Math.min(a, b), Math.max(a, b)];
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
  const [showCheckout, setShowCheckout] = useState(false);

  // 🧮 presupuesto de palabras en base a idioma + rango de duración (cap a 60s)
  const [minSec, maxSec] = useMemo(() => {
    const r = parseDurationRange(duration) ?? [0, 60];
    // Nunca permitimos más de 60s
    return [Math.min(r[0], MAX_SEC), Math.min(r[1], MAX_SEC)];
  }, [duration]);

  const secondsCap = maxSec; // Usamos el extremo superior del rango
  const wps = WPS[language] ?? 2.5; // fallback conservador
  const wordBudget = Math.max(1, Math.floor(wps * secondsCap)); // palabras objetivo

  const descMax = 400;  // límite suave para prompt (evita descripciones kilométricas)
  const ctaMax = 80;

  const handleSubmit = useCallback(async () => {
    flushSync(() => setProcessing(true));

    const ok = await ensureSubscribed({ feature: "script" });
    if (!ok) {
      setProcessing(false);
      setShowCheckout(true);
      return;
    }

    if (!description || !tone || !platform || !duration || !structure || !language) {
      toast.error("⚠️ Por favor, completa todos los campos obligatorios.");
      setProcessing(false);
      return;
    }

    // Tope duro de seguridad: jamás permitir >60s
    if (secondsCap > MAX_SEC) {
      toast.error("⏱️ La duración seleccionada excede el máximo permitido (60s).");
      setProcessing(false);
      return;
    }

    // Limitar inputs (calidad/protección prompt)
    if (description.length > descMax) {
      toast.error(`⚠️ La descripción es demasiado larga (máx. ${descMax} caracteres).`);
      setProcessing(false);
      return;
    }
    if (addCTA && ctaText.length > ctaMax) {
      toast.error(`⚠️ El CTA es demasiado largo (máx. ${ctaMax} caracteres).`);
      setProcessing(false);
      return;
    }

    try {
      // 💡 RECOMENDACIÓN: en el backend (route.ts) usa `wordBudget` y `secondsCap`
      // para instruir al modelo: “no excedas ~{wordBudget} palabras (~{secondsCap}s)”.
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
    language,
    addCTA,
    ctaText,
    secondsCap,
    onSubmit,
  ]);

  const isLoading = processing || loading;
  const buttonText = processing ? "Procesando..." : loading ? "Generando..." : "Generar guion";

  // Opciones estáticas memoizadas
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
      { value: "0-15", label: "0–15 segundos" },
      { value: "15-30", label: "15–30 segundos" },
      { value: "30-45", label: "30–45 segundos" },
      { value: "45-60", label: "45–60 segundos" },
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
              maxLength={400}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/400
            </p>
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
            <p className="text-xs text-muted-foreground mt-1">
              Tope: ~{wordBudget} palabras para ≈{secondsCap}s (máximo absoluto {MAX_SEC}s).
            </p>
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
            <p className="text-xs text-muted-foreground mt-1">
              Velocidad base 1×. El TTS final no excederá 60s.
            </p>
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
          <>
            <Input
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Ej: Sígueme para más consejos"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">{ctaText.length}/80</p>
          </>
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

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Necesitas una suscripción activa para generar guiones."
      />
    </div>
  );
}

