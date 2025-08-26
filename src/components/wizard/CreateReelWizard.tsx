"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";
import { ScriptForm } from "@/components/script/ScriptForm";
import { AudioForm } from "@/components/audio/AudioForm";
import { useAudioForm } from "@/components/audio/useAudioForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import { useRouter } from "next/navigation";
import CreatePipelineVideoPage from "../edit/CreatePipelineVideoPage";

// 👇 Importa nuestro helper
import { track } from "@/lib/analytics-events";

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
  onComplete: (data: ReelData) => void;
};

export default function CreateReelWizard({ onComplete }: CreateReelWizardProps) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

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
  const [audioId, setAudioId] = useState<string | null>(null);

  // Paso 3 - Vídeos de clonación
  const [videos, setVideos] = useState<{ id: string; name: string; url: string }[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

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
      const token = await user.getIdToken();
      const res = await fetch("/api/chatgpt/scripts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description, tone, platform, duration, language, structure, addCTA, ctaText }),
      });
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error generando guion");
      setScript(parsed.script || "");
      setModalType("script");
      toast.success("✅ Guion generado correctamente", { id: loadingId });

      // 📊 Evento GA
      track("script_generated", { platform, tone, language });
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
      const token = await user?.getIdToken();
      const res = await fetch("/api/chatgpt/scripts/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description, tone, platform, duration, language, structure, addCTA, ctaText }),
      });
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando guion");
      setScript(parsed.script || "");
      toast.success("✅ Guion regenerado", { id: loadingId });

      // 📊 Evento GA
      track("script_regenerated", { count: scriptRegens + 1 });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo regenerar el guion.", { id: loadingId });
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const acceptScript = () => {
    audioForm.setText(script);
    toast.success("📜 Guion aceptado. Vamos al audio.");
    setModalType("main");
    setStep(2);

    // 📊 Evento GA
    track("script_accepted");
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      setAudioId(parsed.audioId || null);
      setModalType("audio");
      toast.success("✅ Audio generado correctamente", { id: loadingId });

      // 📊 Evento GA
      track("audio_generated", { voiceId: audioForm.voiceId });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudo generar el audio.", { id: loadingId });
    } finally {
      audioForm.setLoading(false);
    }
  };

  const regenerateAudio = async () => {
    if (!audioId) {
      toast.error("No hay audio base para regenerar.");
      return;
    }
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          parentAudioId: audioId,
          text: audioForm.text,
          voiceId: audioForm.voiceId,
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
      if (!res.ok) throw new Error(parsed.error || "Error regenerando audio");
      setAudioUrl(parsed.audioUrl || null);
      toast.success("✅ Audio regenerado", { id: loadingId });

      // 📊 Evento GA
      track("audio_regenerated", { count: audioRegens + 1 });
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

    // 📊 Evento GA
    track("audio_accepted");
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

      // 📊 Evento GA
      track("clonacion_videos_loaded", { count: list.length });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudieron cargar los vídeos de clonación.");
    } finally {
      setLoadingVideos(false);
    }
  };

  // --- Breadcrumb / Stepper ---
  const steps = ["Guion", "Audio", "Video"];

  return (
    <div className="max-w-4xl mx-auto rounded-xl shadow p-6 bg-white dark:bg-neutral-900 transition-colors">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((label, i) => {
          const current = i + 1 === step;
          const completed = i + 1 < step;
          return (
            <div key={label} className="flex items-center w-full">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${
                  completed || current
                    ? "bg-primary text-white"
                    : "bg-gray-300 dark:bg-neutral-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`ml-2 text-sm ${
                  current
                    ? "font-semibold text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {label}
              </span>
              {i < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-4 bg-gray-300 dark:bg-neutral-700" />
              )}
            </div>
          );
        })}
      </div>

      {/* --- Contenido del Wizard --- */}
      {/* Paso 1 */}
      {modalType === "main" && step === 1 && (
        <>
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
          <div className="flex justify-start mt-6">
            <Button variant="outline" disabled>
              Atrás
            </Button>
          </div>
        </>
      )}

      {/* Paso 2 */}
      {modalType === "main" && step === 2 && (
        <>
          <AudioForm {...audioForm} onGenerate={generateAudio} />
          <div className="flex justify-start mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
          </div>
        </>
      )}

      {/* Paso 3 */}
      {modalType === "main" && step === 3 && (
        <>
          {loadingVideos ? (
            <p className="text-gray-600 dark:text-gray-300">Cargando vídeos...</p>
          ) : (
            <CreatePipelineVideoPage
              preloadedVideos={videos}
              audioUrl={audioUrl!} // 👈 el audio generado
              onComplete={() => {
                toast.success("🎬 Reel enviado al pipeline");
                router.push("/dashboard/edit");
              }}
            />
          )}
          <div className="flex justify-start mt-6">
            <Button variant="outline" onClick={() => setStep(2)}>
              Atrás
            </Button>
          </div>
        </>
      )}

      {/* Guion generado */}
      {modalType === "script" && (
        <div>
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">Guion generado</h2>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="min-h-[200px] w-full resize-none"
          />
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setModalType("main")}>Atrás</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={regenerateScript} disabled={scriptRegens >= 2}>
                Regenerar ({scriptRegens}/2)
              </Button>
              <Button onClick={acceptScript}>Aceptar guion</Button>
            </div>
          </div>
        </div>
      )}

      {/* Audio generado */}
      {modalType === "audio" && (
        <div>
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">Audio generado</h2>
          {audioUrl ? (
            <audio controls src={audioUrl} className="w-full my-4" />
          ) : (
            <p className="text-gray-600 dark:text-gray-300">No se ha generado audio.</p>
          )}
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setModalType("main")}>Atrás</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={regenerateAudio} disabled={audioRegens >= 2}>
                Regenerar ({audioRegens}/2)
              </Button>
              <Button onClick={acceptAudio}>Aceptar audio</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
