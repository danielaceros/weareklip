"use client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

interface Voice { id: string; name: string; }

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
  onGenerate: () => void;
  loading: boolean;
}

export function AudioForm(props: AudioFormProps) {
  const {
    text, setText,
    voices, voiceId, setVoiceId,
    languageCode, setLanguageCode,
    stability, setStability,
    similarityBoost, setSimilarityBoost,
    style, setStyle,
    speed, setSpeed,
    speakerBoost, setSpeakerBoost,
    onGenerate, loading
  } = props;

  return (
    <div className="w-full space-y-6 py-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <AlertCircle className="w-6 h-6 text-primary" /> Generar nuevo audio
      </h1>

      <div>
        <Label>Texto *</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe el texto..."
        />
      </div>

      <div>
        <Label>Voz *</Label>
        <Select onValueChange={setVoiceId} value={voiceId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una voz" />
          </SelectTrigger>
          <SelectContent>
            {voices.length > 0 ? (
              voices.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))
            ) : (
              <SelectItem value="no-voices" disabled>No tienes voces guardadas</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Idioma</Label>
        <Select onValueChange={setLanguageCode} value={languageCode}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="en">Inglés</SelectItem>
            <SelectItem value="fr">Francés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Estabilidad ({stability.toFixed(2)})</Label>
        <Slider value={[stability]} min={0} max={1} step={0.01} onValueChange={(v) => setStability(v[0])} />
      </div>
      <div>
        <Label>Similaridad ({similarityBoost.toFixed(2)})</Label>
        <Slider value={[similarityBoost]} min={0} max={1} step={0.01} onValueChange={(v) => setSimilarityBoost(v[0])} />
      </div>
      <div>
        <Label>Estilo ({style.toFixed(2)})</Label>
        <Slider value={[style]} min={0} max={1} step={0.01} onValueChange={(v) => setStyle(v[0])} />
      </div>
      <div>
        <Label>Velocidad ({speed.toFixed(2)})</Label>
        <Slider value={[speed]} min={0.5} max={2.0} step={0.01} onValueChange={(v) => setSpeed(v[0])} />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox checked={speakerBoost} onCheckedChange={(c) => setSpeakerBoost(!!c)} />
        <Label>Usar Speaker Boost</Label>
      </div>

      <Button onClick={onGenerate} disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        {loading ? "Generando audio..." : "Generar audio"}
      </Button>
    </div>
  );
}
