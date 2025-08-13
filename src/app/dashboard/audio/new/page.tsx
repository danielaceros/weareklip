"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AudioCreatorPage() {
  const searchParams = useSearchParams();
  const defaultText = searchParams.get("text") || "";
  const [text, setText] = useState(defaultText);
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [languageCode, setLanguageCode] = useState("es");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0.0);
  const [speed, setSpeed] = useState(1.0);
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Detectar usuario y cargar voces
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        toast.info("Cargando voces disponibles...");
        try {
          const voicesRef = collection(db, "users", currentUser.uid, "voices");
          const snapshot = await getDocs(voicesRef);
          const loadedVoices: { id: string; name: string }[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedVoices.push({
              id: docSnap.id,
              name: data.name || docSnap.id,
            });
          });
          setVoices(loadedVoices);
          if (loadedVoices.length > 0) {
            toast.success(`${loadedVoices.length} voces encontradas`);
          } else {
            toast.warning("No tienes voces guardadas, primero crea o clona una voz.");
          }
        } catch (err) {
          console.error(err);
          toast.error("Error cargando voces desde la base de datos.");
        }
      } else {
        setVoices([]);
      }
    });

    return () => unsub();
  }, []);

  // Avisar si hay texto precargado
  useEffect(() => {
    if (defaultText) {
      toast.success("Texto cargado automáticamente desde el guion seleccionado");
    }
  }, [defaultText]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error("Debes escribir el texto a convertir.");
      return;
    }
    if (!voiceId) {
      toast.error("Debes seleccionar una voz.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión para generar audios.");
      return;
    }

    setLoading(true);
    toast.info("Generando audio, por favor espera...");

    try {
      const token = await user.getIdToken();

      const res = await fetch("/api/elevenlabs/audio/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          voiceId,
          language_code: languageCode,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            speed,
            use_speaker_boost: speakerBoost,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando audio");

      toast.success("✅ Audio generado correctamente");
      router.push("/dashboard/audio");
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "No se pudo generar el audio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <AlertCircle className="w-6 h-6 text-primary" /> Generar nuevo audio
      </h1>

      <div>
        <Label>Texto *</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe el texto que quieres convertir a audio..."
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

      <Button onClick={handleGenerate} disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        {loading ? "Generando audio..." : "Generar audio"}
      </Button>
    </div>
  );
}
