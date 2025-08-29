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
import { track, withTiming } from "@/lib/analytics-events";

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

type CreateReelWizardProps = { onComplete: (data: ReelData) => void; };

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

  // Paso 3 - Vídeos clonación
  const [videos, setVideos] = useState<{ id: string; name: string; url: string }[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const [scriptRegens, setScriptRegens] = useState(0);
  const [audioRegens, setAudioRegens] = useState(0);

  const { ensureSubscribed } = useSubscriptionGate();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    track("wizard_opened");
    return () => unsub();
  }, []);

  useEffect(() => {
    track("wizard_step_viewed", { step, modalType });
  }, [step, modalType]);

  // --- Paso 1: guion ---
  const generateScript = async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) {
      track("subscription_gate_blocked", { feature: "reel", step: "script" });
      return;
    }
    if (!description || !tone || !platform || !duration || !structure) {
      toast.error("Por favor, completa todos los campos obligatorios.");
      track("script_generate_validation_error");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión para continuar.");
      track("script_generate_noauth");
      return;
    }
    const loadingId = toast.loading("✍️ Generando guion...");
    setLoading(true);
    track("script_generate_clicked", { tone, platform, duration, language, structure, addCTA: !!addCTA });

    try {
      const token = await user.getIdToken();
      const res = await withTiming("script_generate", async () =>
        fetch("/api/chatgpt/scripts/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ description, tone, platform, duration, language, structure, addCTA, ctaText }),
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error generando guion");
      setScript(parsed.script || "");
      setModalType("script");
      toast.success("✅ Guion generado correctamente", { id: loadingId });
      track("script_generate_succeeded", { length: (parsed.script || "").length });
    } catch (err: any) {
      console.error(err);
      toast.error("❌ No se pudo generar el guion.", { id: loadingId });
      track("script_generate_failed", { error: String(err?.message || err) });
    } finally {
      setLoading(false);
    }
  };

  const regenerateScript = async () => {
    if (scriptRegens >= 2) {
      toast.error("⚠️ Ya has regenerado el guion 2 veces.");
      track("script_regenerate_limit_reached");
      return;
    }
    setScriptRegens((c) => c + 1);
    const loadingId = toast.loading("🔄 Regenerando guion...");
    track("script_regenerate_clicked", { count: scriptRegens + 1 });
    try {
      const token = await user?.getIdToken();
      const res = await withTiming("script_regenerate", async () =>
        fetch("/api/chatgpt/scripts/regenerate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ description, tone, platform, duration, language, structure, addCTA, ctaText }),
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando guion");
      setScript(parsed.script || "");
      toast.success("✅ Guion regenerado", { id: loadingId });
      track("script_regenerate_succeeded", { length: (parsed.script || "").length });
    } catch (err: any) {
      console.error(err);
      toast.error("❌ No se pudo regenerar el guion.", { id: loadingId });
      track("script_regenerate_failed", { error: String(err?.message || err) });
    }
  };

  const acceptScript = () => {
    audioForm.setText(script);
    toast.success("📜 Guion aceptado. Vamos al audio.");
    track("script_accepted", { length: script.length });
    setModalType("main");
    setStep(2);
  };

  // --- Paso 2: audio ---
  const generateAudio = async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) {
      track("subscription_gate_blocked", { feature: "reel", step: "audio" });
      return;
    }
    if (!audioForm.voiceId) {
      toast.error("Selecciona una voz antes de continuar.");
      track("audio_generate_validation_error");
      return;
    }
    if (!user) {
      toast.error("Debes iniciar sesión.");
      track("audio_generate_noauth");
      return;
    }
    const loadingId = toast.loading("🎙 Generando audio...");
    audioForm.setLoading(true);
    track("audio_generate_clicked", {
      voiceId: audioForm.voiceId,
      language_code: audioForm.languageCode,
      stability: audioForm.stability,
      similarity_boost: audioForm.similarityBoost,
      style: audioForm.style,
      speed: audioForm.speed,
      speaker_boost: audioForm.speakerBoost,
    });
    try {
      const token = await user.getIdToken();
      const res = await withTiming("audio_generate", async () =>
        fetch("/api/elevenlabs/audio/create", {
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
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error generando audio");
      setAudioUrl(parsed.audioUrl || null);
      setAudioId(parsed.audioId || null);
      setModalType("audio");
      toast.success("✅ Audio generado correctamente", { id: loadingId });
      track("audio_generate_succeeded", { audioId: parsed.audioId ? "yes" : "no" });
    } catch (err: any) {
      console.error(err);
      toast.error("❌ No se pudo generar el audio.", { id: loadingId });
      track("audio_generate_failed", { error: String(err?.message || err) });
    } finally {
      audioForm.setLoading(false);
    }
  };

  const regenerateAudio = async () => {
    if (!audioId) {
      toast.error("No hay audio base para regenerar.");
      track("audio_regenerate_no_base");
      return;
    }
    if (audioRegens >= 2) {
      toast.error("⚠️ Ya has regenerado el audio 2 veces.");
      track("audio_regenerate_limit_reached");
      return;
    }
    setAudioRegens((c) => c + 1);
    const loadingId = toast.loading("🔄 Regenerando audio...");
    track("audio_regenerate_clicked", { count: audioRegens + 1 });
    try {
      const token = await user?.getIdToken();
      const res = await withTiming("audio_regenerate", async () =>
        fetch("/api/elevenlabs/audio/regenerate", {
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
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando audio");
      setAudioUrl(parsed.audioUrl || null);
      toast.success("✅ Audio regenerado", { id: loadingId });
      track("audio_regenerate_succeeded");
    } catch (err: any) {
      console.error(err);
      toast.error("❌ No se pudo regenerar el audio.", { id: loadingId });
      track("audio_regenerate_failed", { error: String(err?.message || err) });
    }
  };

  const acceptAudio = () => {
    toast.success("🎧 Audio aceptado. Vamos al paso de vídeo.");
    track("audio_accepted", { hasAudio: !!audioUrl });
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
      const snap = await withTiming("clonacion_videos_load", async () => getDocs(clonacionRef));
      const list = snap.docs.map((doc) => {
        const d = doc.data() as { titulo?: string; url?: string } | undefined;
        return { id: doc.id, name: d?.titulo ?? doc.id, url: d?.url ?? "" };
      });
      setVideos(list);
      track("clonacion_videos_loaded", { count: list.length });
    } catch (err) {
      console.error(err);
      toast.error("❌ No se pudieron cargar los vídeos de clonación.");
      track("clonacion_videos_load_failed", { error: String(err) });
    } finally {
      setLoadingVideos(false);
    }
  };

  const steps = ["Guion", "Audio", "Video"];

  return (
  <div className="w-full max-w-4xl mx-auto rounded-xl shadow p-4 sm:p-6 bg-white dark:bg-neutral-900 transition-colors overflow-y-auto">
    {/* Stepper */}
    <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
      {steps.map((label, i) => {
        const current = i + 1 === step;
        const completed = i + 1 < step;
        return (
          <div key={label} className="flex items-center flex-1 min-w-[100px]">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
              ${completed || current
                ? "bg-primary text-white"
                : "bg-gray-300 dark:bg-neutral-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`ml-2 text-sm truncate ${
                current
                  ? "font-semibold text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="hidden sm:flex flex-1 h-0.5 mx-2 sm:mx-4 bg-gray-300 dark:bg-neutral-700" />
            )}
          </div>
        );
      })}
    </div>

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
          setDescription={(v) => { setDescription(v); track("script_description_changed"); }}
          setTone={(v) => { setTone(v); track("script_tone_changed", { tone: v }); }}
          setPlatform={(v) => { setPlatform(v); track("script_platform_changed", { platform: v }); }}
          setDuration={(v) => { setDuration(v); track("script_duration_changed", { duration: v }); }}
          setLanguage={(v) => { setLanguage(v); track("script_language_changed", { language: v }); }}
          setStructure={(v) => { setStructure(v); track("script_structure_changed", { structure: v }); }}
          setAddCTA={(v) => { setAddCTA(v); track("script_cta_toggled", { enabled: v }); }}
          setCtaText={(v) => { setCtaText(v); track("script_cta_text_changed"); }}
          onSubmit={generateScript}
        />
        <div className="flex flex-col sm:flex-row justify-start mt-6 gap-2">
          <Button variant="outline" disabled onClick={() => track("wizard_back_disabled")}>
            Atrás
          </Button>
        </div>
      </>
    )}

    {/* Paso 2 */}
    {modalType === "main" && step === 2 && (
      <>
        <AudioForm {...audioForm} onGenerate={generateAudio} />
        <div className="flex flex-col sm:flex-row justify-start mt-6 gap-2">
          <Button variant="outline" onClick={() => { setStep(1); track("wizard_back_clicked", { to: 1 }); }}>
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
            audioUrl={audioUrl!}
            onComplete={() => {
              track("wizard_completed");
              toast.success("🎬 Reel enviado al pipeline");
              router.push("/dashboard/edit");
            }}
          />
        )}
        <div className="flex flex-col sm:flex-row justify-start mt-6 gap-2">
          <Button variant="outline" onClick={() => { setStep(2); track("wizard_back_clicked", { to: 2 }); }}>
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
          onChange={(e) => { setScript(e.target.value); track("script_edited_manual"); }}
          className="min-h-[200px] w-full resize-none"
        />
        <div className="flex flex-col sm:flex-row justify-between mt-4 gap-2">
          <Button variant="outline" onClick={() => { setModalType("main"); track("script_modal_back"); }}>
            Atrás
          </Button>
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
          <audio
            controls
            src={audioUrl}
            className="w-full my-4"
            onPlay={() => track("audio_preview_play")}
            onEnded={() => track("audio_preview_end")}
          />
        ) : (
          <p className="text-gray-600 dark:text-gray-300">No se ha generado audio.</p>
        )}
        <div className="flex flex-col sm:flex-row justify-between mt-4 gap-2">
          <Button variant="outline" onClick={() => { setModalType("main"); track("audio_modal_back"); }}>
            Atrás
          </Button>
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
