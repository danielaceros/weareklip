"use client";

import { useState, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import useSubscriptionGate from "@/hooks/useSubscriptionGate"; // 👈 añadido
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal"; // 👈 añadido

export default function ScriptCreatorContainer() {
  const [user, setUser] = useState<User | null>(null);

  // Campos del formulario
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("es");
  const [structure, setStructure] = useState("");
  const [addCTA, setAddCTA] = useState(false);
  const [ctaText, setCtaText] = useState("");

  // Script generado / modal
  const [script, setScript] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [scriptRegens, setScriptRegens] = useState(0);

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { ensureSubscribed } = useSubscriptionGate(); // 👈 hook
  const [showCheckout, setShowCheckout] = useState(false); // 👈 estado modal

  // 🔑 Autenticación
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 🚀 Generar script
  const handleGenerate = useCallback(async () => {
    const ok = await ensureSubscribed({ feature: "script" }); // 👈 check
    if (!ok) {
      setShowCheckout(true);
      return;
    }

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
      const idToken = await user.getIdToken();

      const res = await fetch("/api/chatgpt/scripts/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Idempotency-Key": uuidv4(),
        },
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

      flushSync(() => {
        setScript(data.script || "");
        setShowModal(true);
      });
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "No se pudo generar el guion."
      );
    } finally {
      setLoading(false);
    }
  }, [
    description,
    tone,
    platform,
    duration,
    structure,
    language,
    addCTA,
    ctaText,
    user,
    ensureSubscribed,
  ]);

  // 🔄 Regenerar script
  const regenerateScript = useCallback(async () => {
    const ok = await ensureSubscribed({ feature: "script" }); // 👈 check
    if (!ok) {
      setShowCheckout(true);
      return;
    }

    if (scriptRegens >= 2) {
      toast.error("⚠️ Ya has regenerado el guion 2 veces.");
      return;
    }
    setScriptRegens((c) => c + 1);

    const loadingId = toast.loading("🔄 Regenerando guion...");
    try {
      if (!user) throw new Error("No autenticado");
      const idToken = await user.getIdToken();

      const res = await fetch("/api/chatgpt/scripts/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
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

      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando guion");

      setScript(parsed.script || "");
      toast.success("✅ Guion regenerado", { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo regenerar el guion.", { id: loadingId });
    } finally {
      toast.dismiss(loadingId);
    }
  }, [
    user,
    scriptRegens,
    description,
    tone,
    platform,
    duration,
    language,
    structure,
    addCTA,
    ctaText,
    ensureSubscribed,
  ]);

  // 💾 Aceptar y guardar script
  const acceptScript = useCallback(async () => {
    if (!user) return;

    flushSync(() => {
      setShowModal(false);
    });
    const toastId = toast.loading("💾 Guardando guion...");

    try {
      const idToken = await user.getIdToken();
      const scriptId = uuidv4();

      const res = await fetch(
        `/api/firebase/users/${user.uid}/scripts/${scriptId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            description,
            tone,
            platform,
            duration,
            language,
            structure,
            addCTA,
            ctaText,
            script,
            createdAt: Date.now(),
            scriptId,
            regenerations: scriptRegens,
            isAI: true,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      toast.success("✅ Guion guardado correctamente", { id: toastId });
      router.push("/dashboard/script");
    } catch (err) {
      console.error("❌ Error al guardar guion:", err);
      toast.error("No se pudo guardar el guion.", { id: toastId });
    }
  }, [
    user,
    description,
    tone,
    platform,
    duration,
    language,
    structure,
    addCTA,
    ctaText,
    script,
    scriptRegens,
    router,
  ]);

  return (
    <>
      <div className="space-y-6 p-6 rounded-xl">
        <h2 className="text-xl font-bold">Generación de guion</h2>

        {/* Descripción */}
        <div className="space-y-2">
          <Label>Descripción breve</Label>
          <Textarea
            placeholder="Escribe una breve descripción..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none"
          />
        </div>

        {/* Filtros */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tono</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar un tono" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="informal">Informal</SelectItem>
                <SelectItem value="profesional">Profesional</SelectItem>
                <SelectItem value="emocional">Emocional</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar una plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Duración</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar una duración" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30s">30 segundos</SelectItem>
                <SelectItem value="60s">1 minuto</SelectItem>
                <SelectItem value="120s">2 minutos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Idioma</Label>
            <Select value={language} onValueChange={setLanguage}>
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
            <Label>Estructura</Label>
            <Select value={structure} onValueChange={setStructure}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar una estructura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="problema-solucion">Problema → Solución</SelectItem>
                <SelectItem value="historia">Historia</SelectItem>
                <SelectItem value="tutorial">Tutorial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={addCTA}
            onCheckedChange={(v) => setAddCTA(v as boolean)}
          />
          <Label>Añadir llamada a la acción (CTA)</Label>
        </div>

        {addCTA && (
          <div className="space-y-2">
            <Label>Texto del CTA</Label>
            <Textarea
              placeholder="Escribe tu CTA..."
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              className="resize-none"
            />
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Generando..." : "Generar guion"}
        </Button>
      </div>

      {/* Modal guion generado */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Guion generado</DialogTitle>
          </DialogHeader>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[200px] w-full resize-none"
          />
          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={regenerateScript}
              disabled={scriptRegens >= 2}
            >
              Regenerar ({scriptRegens}/2)
            </Button>
            <Button onClick={acceptScript}>Aceptar y guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal checkout */}
      <CheckoutRedirectModal
                        open={showCheckout}
                        onClose={() => setShowCheckout(false)}
                        plan="ACCESS" // 👈 el plan que quieras promocionar por defecto
                        message="Para clonar tu voz necesitas suscripción activa, empieza tu prueba GRATUITA de 7 días"
                      />
    </>
  );
}
