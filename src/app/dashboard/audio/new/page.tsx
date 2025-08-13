"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

export default function AudioCreatorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<{ id: string; name: string }[]>([]);
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [languageCode, setLanguageCode] = useState("es");
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0.0);
  const [speed, setSpeed] = useState(1.0);
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Detectar usuario y cargar voces asociadas
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const voicesRef = collection(db, "users", currentUser.uid, "voices");
          const snapshot = await getDocs(voicesRef);
          const loadedVoices: { id: string; name: string }[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            loadedVoices.push({
              id: docSnap.id, // este es el elevenlabsId
              name: data.name || docSnap.id,
            });
          });
          setVoices(loadedVoices);
        } catch (err) {
          console.error(err);
          toast.error("Error cargando voces");
        }
      }
    });
    return () => unsub();
  }, []);

  const handleGenerate = async () => {
    if (!text || !voiceId) {
      toast.error("Por favor, completa el texto y selecciona una voz.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión para generar audios.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/elevenlabs/audio/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      const audioId = uuidv4();
      await setDoc(doc(db, "users", user.uid, "audios", audioId), {
        text,
        voiceId,
        languageCode,
        stability,
        similarityBoost,
        style,
        speed,
        speakerBoost,
        audioUrl: data.audioUrl || "",
        createdAt: serverTimestamp(),
        userEmail: user.email || "",
        userName: user.displayName || "",
        userPhoto: user.photoURL || "",
        audioId,
        generations: 1,
      });

      toast.success("Audio generado correctamente");
      router.push("/dashboard/audios");
    } catch (err: unknown) {
        console.error(err);
        if (err instanceof Error) {
            toast.error(err.message);
        } else {
            toast.error("No se pudo generar el audio.");
        }
        } finally {
        setLoading(false);
        }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <h1 className="text-2xl font-bold">Generar nuevo audio</h1>

      {/* Texto */}
      <div>
        <Label>Texto *</Label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe el texto que quieres convertir a audio..."
        />
      </div>

      {/* Voz */}
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

      {/* Idioma */}
      <div>
        <Label>Idioma</Label>
        <Select onValueChange={setLanguageCode} defaultValue={languageCode}>
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

      {/* Parámetros de voz */}
      <div>
        <Label>Estabilidad ({stability})</Label>
        <Slider value={[stability]} min={0} max={1} step={0.01} onValueChange={(v) => setStability(v[0])} />
      </div>
      <div>
        <Label>Similaridad ({similarityBoost})</Label>
        <Slider value={[similarityBoost]} min={0} max={1} step={0.01} onValueChange={(v) => setSimilarityBoost(v[0])} />
      </div>
      <div>
        <Label>Estilo ({style})</Label>
        <Slider value={[style]} min={0} max={1} step={0.01} onValueChange={(v) => setStyle(v[0])} />
      </div>
      <div>
        <Label>Velocidad ({speed})</Label>
        <Slider value={[speed]} min={0.5} max={2.0} step={0.01} onValueChange={(v) => setSpeed(v[0])} />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox checked={speakerBoost} onCheckedChange={(c) => setSpeakerBoost(!!c)} />
        <Label>Usar Speaker Boost</Label>
      </div>

      {/* Botón */}
      <Button onClick={handleGenerate} disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        Generar audio
      </Button>
    </div>
  );
}
