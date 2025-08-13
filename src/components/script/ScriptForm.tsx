"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ScriptFormProps {
  description: string;
  tone: string;
  platform: string;
  duration: string;
  language: string;
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
  onSubmit: () => void;
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
  onSubmit
}: ScriptFormProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <h1 className="text-2xl font-bold">Crear nuevo guion</h1>

      <div>
        <Label>Descripción breve *</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Quiero un reel motivador sobre productividad para emprendedores"
        />
      </div>

      <div>
        <Label>Tono *</Label>
        <Select onValueChange={setTone} defaultValue={tone}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un tono" />
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

      <div>
        <Label>Plataforma *</Label>
        <Select onValueChange={setPlatform} defaultValue={platform}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona la plataforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="youtube">YouTube Shorts</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Duración *</Label>
        <Select onValueChange={setDuration} defaultValue={duration}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona la duración" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15-30">15–30 segundos</SelectItem>
            <SelectItem value="30-45">30–45 segundos</SelectItem>
            <SelectItem value="45-60">45–60 segundos</SelectItem>
            <SelectItem value="60-90">60–90 segundos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Idioma *</Label>
        <Select onValueChange={setLanguage} defaultValue={language || "es"}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un idioma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="en">Inglés</SelectItem>
            <SelectItem value="fr">Francés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Estructura *</Label>
        <Select onValueChange={setStructure} defaultValue={structure}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una estructura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gancho-desarrollo-cierre">Gancho – Desarrollo – Cierre</SelectItem>
            <SelectItem value="storytelling">Storytelling</SelectItem>
            <SelectItem value="lista-tips">Lista de tips</SelectItem>
            <SelectItem value="pregunta-retorica">Pregunta retórica</SelectItem>
            <SelectItem value="comparativa-antes-despues">Comparativa antes/después</SelectItem>
            <SelectItem value="mito-vs-realidad">Mito vs realidad</SelectItem>
            <SelectItem value="problema-solucion">Problema – Solución</SelectItem>
            <SelectItem value="testimonio">Testimonio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
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

      <Button onClick={onSubmit} disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        Generar guion
      </Button>
    </div>
  );
}
