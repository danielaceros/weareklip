// src/components/wizard/CreateReelWizard.tsx
"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import toast from "react-hot-toast";
import { ScriptForm } from "@/components/script/ScriptForm";
import { AudioForm } from "@/components/audio/AudioForm";
import { useAudioForm } from "@/components/audio/useAudioForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";

// ✅ Nuevo: usamos el integrado
import CreateVideoPage from "@/components/edit/CreateVideoPage";

type ReelData = {
  script: string;
  audioUrl?: string | null;
  selectedVideo?: string;
  subLang?: string;
  template?: string;
  dictionary?: string;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
};

type CreateReelWizardProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (data: ReelData) => void;
};

export default function CreateReelWizard({
  open,
  onClose,
  onComplete,
}: CreateReelWizardProps) {
  const [user, setUser] = useState<User | null>(null);

  // flujo
  const [step, setStep] = useState(1);
  const [modalType, setModalType] = useState<"main" | "script" | "audio">("main");

  // Paso 1 - Guion
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("");
  const [platform, setPlatform] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("es");
  const [structure, setStructure] = useState("");
  const [addCTA, setAddCTA] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState("");

  // Paso 2 - Audio
  const audioForm = useAudioForm("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Paso 3 - Vídeos de clonación
  const [videos, setVideos] = useState<{ id: string; name: string; url: string }[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Regeneraciones
  const [scriptRegens, setScriptRegens] = useState(0);
  const [audioRegens, setAudioRegens] = useState(0);

  const { ensureSubscribed } = useSubscriptionGate();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsub();
  }, []);

  // --- Paso 1: guion ---
  const generateScript = async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) return;

    if (!description || !tone || !platform || !duration || !structure) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión para continuar.");
      return;
    }

    const loadingId = toast.loading("✍️ Generando guion...");
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

      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error generando guion");

      setScript(parsed.script || "");
      setModalType("script");
      toast.success("✅ Guion generado correctamente", { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo generar el guion.", { id: loadingId });
    } finally {
      setLoading(false);
    }
  };

  const regenerateScript = async () => {
    if (scriptRegens >= 2) {
      toast.error("⚠️ Ya has regenerado el guion 2 veces.");
      return;
    }
    setScriptRegens((c) => c + 1);

    const loadingId = toast.loading("🔄 Regenerando guion...");
    try {
      const res = await fetch("/api/chatgpt/scripts/regenerate", {
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
  };

  const acceptScript = () => {
    audioForm.setText(script);
    toast.success("📜 Guion aceptado. Pasamos al audio.");
    setModalType("main");
    setStep(2);
  };

  // --- Paso 2: audio ---
  const generateAudio = async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) return;

    if (!audioForm.voiceId) {
      toast.error("Selecciona una voz antes de continuar.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión.");
      return;
    }

    const loadingId = toast.loading("🎙 Generando audio...");
    audioForm.setLoading(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/elevenlabs/audio/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: audioForm.text,
          voiceId: audioForm.voiceId,
          language_code: audioForm.languageCode,
          voice_settings: {
            stability: audioForm.stability,
            similarity_boost: audioForm.similarityBoost,
            style: audioForm.style,
            speed: audioForm.speed,
            use_speaker_boost: audioForm.speakerBoost,
          },
        }),
      });

      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error generando audio");

      setAudioUrl(parsed.audioUrl || null);
      setModalType("audio");
      toast.success("✅ Audio generado correctamente", { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo generar el audio.", { id: loadingId });
    } finally {
      audioForm.setLoading(false);
    }
  };

  const regenerateAudio = async () => {
    if (audioRegens >= 2) {
      toast.error("⚠️ Ya has regenerado el audio 2 veces.");
      return;
    }
    setAudioRegens((c) => c + 1);

    const loadingId = toast.loading("🔄 Regenerando audio...");
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/elevenlabs/audio/regenerate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: audioForm.text,
          voiceId: audioForm.voiceId,
        }),
      });

      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando audio");

      setAudioUrl(parsed.audioUrl || null);
      toast.success("✅ Audio regenerado", { id: loadingId });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo regenerar el audio.", { id: loadingId });
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const acceptAudio = () => {
    toast.success("🎧 Audio aceptado. Vamos al paso de vídeo.");
    setModalType("main");
    setStep(3);
    void loadClonacionVideos();
  };

  // --- Paso 3: vídeos clonación ---
  const loadClonacionVideos = async () => {
    if (!user) return;
    setLoadingVideos(true);

    try {
      const db = getFirestore();
      const clonacionRef = collection(db, `users/${user.uid}/clonacion`);
      const snap = await getDocs(clonacionRef);

      const list = snap.docs.map((doc) => {
        const d = doc.data() as { titulo?: string; url?: string } | undefined;
        return { id: doc.id, name: d?.titulo ?? doc.id, url: d?.url ?? "" };
      });

      setVideos(list);
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudieron cargar los vídeos de clonación.");
    } finally {
      setLoadingVideos(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-4xl">
        {modalType === "main" && (
          <>
            <DialogHeader>
              <DialogTitle>Crear Reel IA</DialogTitle>
              <DialogDescription>
                Completa los pasos para generar tu reel
              </DialogDescription>
            </DialogHeader>

            {/* Paso 1 */}
            {step === 1 && (
              <ScriptForm
                description={description}
                tone={tone}
                platform={platform}
                duration={duration}
                language={language}
                structure={structure}
                addCTA={addCTA}
                ctaText={ctaText}
                loading={loading}
                setDescription={setDescription}
                setTone={setTone}
                setPlatform={setPlatform}
                setDuration={setDuration}
                setLanguage={setLanguage}
                setStructure={setStructure}
                setAddCTA={setAddCTA}
                setCtaText={setCtaText}
                onSubmit={generateScript}
              />
            )}

            {/* Paso 2 */}
            {step === 2 && (
              <AudioForm {...audioForm} onGenerate={generateAudio} />
            )}

            {/* Paso 3 */}
            {step === 3 && (
              <>
                {loadingVideos ? (
                  <p>Cargando vídeos...</p>
                ) : (
                  <CreateVideoPage
                    preloadedVideos={videos}
                    onComplete={(data) => {
                      onComplete({
                        script,
                        audioUrl,
                        ...data,
                      });
                      onClose();
                    }}
                  />
                )}
              </>
            )}
          </>
        )}

        {modalType === "script" && (
          <>
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
              <Button onClick={acceptScript}>Aceptar y continuar</Button>
            </DialogFooter>
          </>
        )}

        {modalType === "audio" && (
          <>
            <DialogHeader>
              <DialogTitle>Audio generado</DialogTitle>
            </DialogHeader>
            {audioUrl ? (
              <audio controls src={audioUrl} className="w-full my-4" />
            ) : (
              <p>No se ha generado audio.</p>
            )}
            <DialogFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={regenerateAudio}
                disabled={audioRegens >= 2}
              >
                Regenerar ({audioRegens}/2)
              </Button>
              <Button onClick={acceptAudio}>Aceptar y continuar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
