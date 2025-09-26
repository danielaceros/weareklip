// src/components/script/ScriptForm.tsx
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import { useT } from "@/lib/i18n";

interface ScriptFormProps {
  description: string;
  tone: string;        // guardamos la KEY (ideal) o un legacy label
  platform: string;
  duration: string;
  language: string;
  structure: string;   // guardamos la KEY (ideal) o un legacy label
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
  onClose?: () => void;
}

/** ===== KEYS i18n (estables) ===== */
const TONE_KEYS = [
  "motivational",
  "educational",
  "humorous",
  "serious",
  "inspirational",
  "emotional",
  "provocative",
] as const;
type ToneKey = typeof TONE_KEYS[number];

const STRUCTURE_KEYS = [
  "hook_body_close",
  "storytelling",
  "tips_list",
  "rhetorical_question",
  "before_after",
  "myth_vs_reality",
  "problem_solution",
  "testimonial",
] as const;
type StructureKey = typeof STRUCTURE_KEYS[number];

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
  onClose,
}: ScriptFormProps) {
  const t = useT();
  const { ensureSubscribed } = useSubscriptionGate();
  const [processing, setProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  // Helpers de etiquetas traducidas
  const toneLabel = (k: string) =>
    k ? (t(`wizard.toneOptions.${k}`) ?? k) : "";

  const structureLabel = (k: string) =>
    k ? (t(`wizard.structureOptions.${k}`) ?? k) : "";

  // Normalización: si llega un label legacy, lo convertimos a KEY
  useEffect(() => {
    if (tone && !TONE_KEYS.includes(tone as any)) {
      const k = TONE_KEYS.find((key) => t(`wizard.toneOptions.${key}`) === tone);
      if (k) setTone(k);
    }
  }, [tone, setTone, t]);

  useEffect(() => {
    if (structure && !STRUCTURE_KEYS.includes(structure as any)) {
      const k = STRUCTURE_KEYS.find(
        (key) => t(`wizard.structureOptions.${key}`) === structure
      );
      if (k) setStructure(k);
    }
  }, [structure, setStructure, t]);

  const handleSubmit = useCallback(async () => {
    flushSync(() => setProcessing(true));

    const ok = await ensureSubscribed({ feature: "script" });
    if (!ok) {
      setProcessing(false);
      setShowCheckout(true);
      return;
    }

    if (!description || !tone || !platform || !duration || !structure) {
      toast.error(t("scriptsCreator.toasts.fillAll"));
      setProcessing(false);
      return;
    }

    try {
      await onSubmit();
      if (typeof onClose === "function") onClose();
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
    onClose,
    t,
  ]);

  const isLoading = processing || loading;
  const buttonText = processing
    ? t("common.processing")
    : loading
    ? t("scriptsForm.buttons.generating")
    : t("scriptsForm.buttons.generate");

  // Opciones traducidas (recalcular al cambiar de idioma)
  const toneOptions = useMemo(
    () => TONE_KEYS.map((key) => ({ value: key, label: toneLabel(key) })),
    [t] // depende de t() para re-render al cambiar locale
  );

  const platformOptions = useMemo(
    () => [
      { value: "instagram", label: t("scriptsForm.options.platforms.instagram") },
      { value: "tiktok", label: t("scriptsForm.options.platforms.tiktok") },
      { value: "youtube", label: t("scriptsForm.options.platforms.youtube") },
      { value: "linkedin", label: t("scriptsForm.options.platforms.linkedin") },
    ],
    [t]
  );

  const durationOptions = useMemo(
    () => [
      { value: "0-15", label: t("scriptsForm.options.durations.0-15") },
      { value: "15-30", label: t("scriptsForm.options.durations.15-30") },
      { value: "30-45", label: t("scriptsForm.options.durations.30-45") },
      { value: "45-60", label: t("scriptsForm.options.durations.45-60") },
    ],
    [t]
  );

  const languageOptions = useMemo(
    () => [
      { value: "es", label: t("scriptsForm.options.languages.es") },
      { value: "en", label: t("scriptsForm.options.languages.en") },
      { value: "fr", label: t("scriptsForm.options.languages.fr") },
    ],
    [t]
  );

  const structureOptions = useMemo(
    () =>
      STRUCTURE_KEYS.map((key) => ({
        value: key,
        label: structureLabel(key),
      })),
    [t]
  );

  // Para Select controlado: si todavía no tenemos una KEY válida, value=""
  const toneValue = TONE_KEYS.includes(tone as any) ? tone : "";
  const structureValue = STRUCTURE_KEYS.includes(structure as any) ? structure : "";

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("scriptsForm.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("scriptsForm.header.subtitle")}
        </p>
      </header>

      {/* Formulario en dos columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Columna izquierda */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>{t("scriptsForm.labels.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("scriptsForm.placeholders.description")}
              className="min-h-[120px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("scriptsForm.labels.tone")}</Label>
            <Select onValueChange={setTone} value={toneValue}>
              <SelectTrigger>
                <SelectValue placeholder={t("scriptsForm.placeholders.tone")} />
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
            <Label>{t("scriptsForm.labels.platform")}</Label>
            <Select onValueChange={setPlatform} value={platform}>
              <SelectTrigger>
                <SelectValue placeholder={t("scriptsForm.placeholders.platform")} />
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
            <Label>{t("scriptsForm.labels.duration")}</Label>
            <Select onValueChange={setDuration} value={duration}>
              <SelectTrigger>
                <SelectValue placeholder={t("scriptsForm.placeholders.duration")} />
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
            <Label>{t("scriptsForm.labels.language")}</Label>
            <Select onValueChange={setLanguage} value={language || "es"}>
              <SelectTrigger>
                <SelectValue placeholder={t("scriptsForm.placeholders.language")} />
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
            <Label>{t("scriptsForm.labels.structure")}</Label>
            <Select onValueChange={setStructure} value={structureValue}>
              <SelectTrigger>
                <SelectValue placeholder={t("scriptsForm.placeholders.structure")} />
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
          <Label>{t("scriptsForm.labels.addCTA")}</Label>
        </div>
        {addCTA && (
          <Input
            value={ctaText}
            onChange={(e) => setCtaText(e.target.value)}
            placeholder={t("scriptsForm.placeholders.ctaText")}
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

      {/* Modal paywall */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message={t("scriptsCreator.checkout.message")}
      />
    </div>
  );
}
