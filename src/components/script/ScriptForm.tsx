"use client";

import { useState } from "react";
import { flushSync } from "react-dom"; // 👈 Import clave
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

  const handleSubmit = async () => {
    flushSync(() => {
      setProcessing(true);
    });
    const ok = await ensureSubscribed({ feature: "script" });
    if (!ok) {
      toast.error("Necesitas una suscripción activa para generar guiones.");
      return;
    }

    if (!description || !tone || !platform || !duration || !structure) {
      toast.error("⚠️ Por favor, completa todos los campos obligatorios.");
      return;
    }
    
    try {
      await onSubmit();
    } finally {
      setProcessing(false);
    }
  };

  const isLoading = processing || loading;
  const buttonText = processing
    ? "Procesando..."
    : loading
    ? "Generando..."
    : "Generar guion";

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
                <SelectItem value="motivador">Motivador</SelectItem>
                <SelectItem value="educativo">Educativo</SelectItem>
                <SelectItem value="humoristico">Humorístico</SelectItem>
                <SelectItem value="serio">Serio</SelectItem>
                <SelectItem value="inspirador">Inspirador</SelectItem>
                <SelectItem value="emocional">Emocional</SelectItem>
                <SelectItem value="provocador">Provocador</SelectItem>
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
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube Shorts</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
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
                <SelectItem value="15-30">15–30 segundos</SelectItem>
                <SelectItem value="30-45">30–45 segundos</SelectItem>
                <SelectItem value="45-60">45–60 segundos</SelectItem>
                <SelectItem value="60-90">60–90 segundos</SelectItem>
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
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">Inglés</SelectItem>
                <SelectItem value="fr">Francés</SelectItem>
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
                <SelectItem value="gancho-desarrollo-cierre">
                  Gancho – Desarrollo – Cierre
                </SelectItem>
                <SelectItem value="storytelling">Storytelling</SelectItem>
                <SelectItem value="lista-tips">Lista de tips</SelectItem>
                <SelectItem value="pregunta-retorica">
                  Pregunta retórica
                </SelectItem>
                <SelectItem value="comparativa-antes-despues">
                  Comparativa antes/después
                </SelectItem>
                <SelectItem value="mito-vs-realidad">Mito vs realidad</SelectItem>
                <SelectItem value="problema-solucion">
                  Problema – Solución
                </SelectItem>
                <SelectItem value="testimonio">Testimonio</SelectItem>
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
