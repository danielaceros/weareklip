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
import { Label } from "@/components/ui/label";
import { LanguageSelect } from "@/components/edit/LanguageSelect";
import { TemplateSelect } from "@/components/edit/TemplateSelect";
import { DictionaryInput } from "@/components/edit/DictionaryInput";
import { MagicOptions } from "@/components/edit/MagicOptions";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";

type ReelData = {
  script: string;
  audioUrl?: string;
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

// helpers sin any
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function hasString(v: unknown, key: string): v is Record<string, string> {
  return isRecord(v) && typeof v[key] === "string";
}

export default function CreateReelWizard({
  open,
  onClose,
  onComplete,
}: CreateReelWizardProps) {
  const [user, setUser] = useState<User | null>(null);

  // flujo de pasos
  const [step, setStep] = useState(1);
  const [modalType, setModalType] = useState<"main" | "script" | "audio">(
    "main"
  );

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

  // Paso 3 - Submagic
  const [videos, setVideos] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState("");
  const [subLang, setSubLang] = useState("");
  const [template, setTemplate] = useState("");
  const [dictionary, setDictionary] = useState("");
  const [magicZooms, setMagicZooms] = useState(false);
  const [magicBrolls, setMagicBrolls] = useState(false);
  const [magicBrollsPercentage, setMagicBrollsPercentage] = useState(50);
  const [syncLoading, setSyncLoading] = useState(false);

  // 🔹 Contadores regeneración
  const [scriptRegens, setScriptRegens] = useState(0);
  const [audioRegens, setAudioRegens] = useState(0);

  const { ensureSubscribed } = useSubscriptionGate();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (currentUser) =>
      setUser(currentUser)
    );
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

      if (snap.empty) {
        setVideos([]);
        toast("ℹ️ No tienes vídeos de clonación todavía.");
        return;
      }

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

  const finishWizard = async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) return;

    if (!audioUrl || !selectedVideo) {
      toast.error("Falta el audio o el vídeo para continuar.");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión.");
      return;
    }

    const loadingId = toast.loading("🚀 Enviando vídeo para editar...");
    setSyncLoading(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/sync/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioUrl,
          videoUrl: selectedVideo,
          subLang,
          template,
          dictionary,
          magicZooms,
          magicBrolls,
          magicBrollsPercentage,
        }),
      });

      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error al iniciar lipsync");

      toast.success(
        `🎬 Enviado correctamente, recibirás el vídeo en unos minutos a ${user.email}`,
        { id: loadingId }
      );

      onComplete({
        script,
        audioUrl,
        selectedVideo,
        subLang,
        template,
        dictionary,
        magicZooms,
        magicBrolls,
        magicBrollsPercentage,
      });

      onClose();
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo iniciar el lipsync.", { id: loadingId });
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl">
        {modalType === "main" && (
          <>
            <DialogHeader>
              <DialogTitle>Crear Reel IA</DialogTitle>
              <DialogDescription>
                Completa los pasos para generar tu reel
              </DialogDescription>
            </DialogHeader>

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

            {step === 2 && (
              <AudioForm {...audioForm} onGenerate={generateAudio} />
            )}

            {step === 3 && (
              <div className="space-y-4">
                <Label>Selecciona un vídeo de clonación</Label>

                {loadingVideos ? (
                  <p>Cargando vídeos...</p>
                ) : videos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {videos.map((v) => (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVideo(v.url)}
                        className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                          selectedVideo === v.url ? "ring-2 ring-blue-500" : ""
                        }`}
                      >
                        <video
                          src={v.url}
                          className="w-full h-40 object-cover"
                          controls={false}
                          muted
                          loop
                          playsInline
                          onMouseEnter={(e) => e.currentTarget.play()}
                          onMouseLeave={(e) => e.currentTarget.pause()}
                        />
                        <div className="p-2 text-sm font-medium truncate">
                          {v.name}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No hay vídeos en clonación.
                  </p>
                )}

                <LanguageSelect value={subLang} onChange={setSubLang} />
                <TemplateSelect value={template} onChange={setTemplate} />
                <DictionaryInput value={dictionary} onChange={setDictionary} />
                <MagicOptions
                  magicZooms={magicZooms}
                  setMagicZooms={setMagicZooms}
                  magicBrolls={magicBrolls}
                  setMagicBrolls={setMagicBrolls}
                  magicBrollsPercentage={magicBrollsPercentage}
                  setMagicBrollsPercentage={setMagicBrollsPercentage}
                />

                <Button
                  disabled={!selectedVideo || syncLoading}
                  onClick={finishWizard}
                  className="w-full"
                >
                  {syncLoading ? "Procesando..." : "Guardar y salir"}
                </Button>
              </div>
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
