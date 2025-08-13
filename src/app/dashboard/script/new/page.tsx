"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

export default function ScriptCreatorPage() {
  const [user, setUser] = useState<User | null>(null);
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("es");
  const [structure, setStructure] = useState("");
  const [addCTA, setAddCTA] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  const handleGenerate = async () => {
    if (!description || !tone || !platform || !duration || !structure) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión para crear guiones.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/chatgpt/scripts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          tone,
          platform,
          duration,
          language,
          structure,
          addCTA,
          ctaText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generando guion");

      const scriptId = uuidv4();
      await setDoc(doc(db, "users", user.uid, "guiones", scriptId), {
        description,
        tone,
        platform,
        duration,
        language,
        structure,
        addCTA,
        ctaText,
        script: data.script || "",
        createdAt: serverTimestamp(),
        userEmail: user.email || "",
        userName: user.displayName || "",
        userPhoto: user.photoURL || "",
        scriptId,
        regenerations: 0,
      });

      toast.success("Guion generado correctamente");
      router.push("/dashboard/script");
    } catch (err: unknown) {
    console.error(err);
    if (err instanceof Error) {
        toast.error(err.message);
    } else {
        toast.error("No se pudo generar el guion.");
    }
    } finally {
    setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <h1 className="text-2xl font-bold">Crear nuevo guion</h1>

      {/* Descripción breve */}
      <div>
        <Label>Descripción breve *</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Quiero un reel motivador sobre productividad para emprendedores"
        />
      </div>

      {/* Tono */}
      <div>
        <Label>Tono *</Label>
        <Select onValueChange={setTone}>
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

      {/* Plataforma */}
      <div>
        <Label>Plataforma *</Label>
        <Select onValueChange={setPlatform}>
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

      {/* Duración */}
      <div>
        <Label>Duración *</Label>
        <Select onValueChange={setDuration}>
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

      {/* Idioma */}
      <div>
        <Label>Idioma *</Label>
        <Select onValueChange={setLanguage} defaultValue="es">
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

      {/* Estructura */}
      <div>
        <Label>Estructura *</Label>
        <Select onValueChange={setStructure}>
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

      {/* CTA */}
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

      {/* Botón */}
      <Button onClick={handleGenerate} disabled={loading} className="w-full">
        {loading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        Generar guion
      </Button>
    </div>
  );
}
