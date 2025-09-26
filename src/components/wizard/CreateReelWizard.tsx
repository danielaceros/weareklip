// src/app/dashboard/.../CreateReelWizard.tsx
"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";
import { ScriptForm } from "@/components/script/ScriptForm";
import { AudioForm } from "@/components/audio/AudioForm";
import { useAudioForm } from "@/components/audio/useAudioForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import { useRouter } from "next/navigation";
import CreatePipelineVideoPage from "../edit/CreatePipelineVideoPage";
import { track, withTiming } from "@/lib/analytics-events";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";
import { useT } from "@/lib/i18n";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

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

type CreateReelWizardProps = { onComplete: (data: ReelData) => void };

/** ===== Opciones i18n basadas en KEYS estables (no etiquetas) ===== */
const TONE_KEYS = [
  "motivational",
  "educational",
  "humorous",
  "serious",
  "inspirational",
  "emotional",
  "provocative",
] as const;
type ToneKey = typeof TONE_KEYS[number];

const STRUCTURE_KEYS = [
  "hook_body_close",
  "storytelling",
  "tips_list",
  "rhetorical_question",
  "before_after",
  "myth_vs_reality",
  "problem_solution",
  "testimonial",
] as const;
type StructureKey = typeof STRUCTURE_KEYS[number];

/** === Helper para voces (id puede venir como id o voice_id) === */
const getVoiceId = (v: any) => v?.voice_id ?? v?.id ?? "";

const SPEED_MIN = 0.7;
const SPEED_MAX = 1.2;
const clampSpeed = (x: number) =>
  Math.min(SPEED_MAX, Math.max(SPEED_MIN, Number.isFinite(x) ? x : 1));

/* ---------------------------------------------------------
   Helpers de “nombres bonitos” para los vídeos de clonación
--------------------------------------------------------- */
function looksLikeStoragePath(s?: string) {
  if (!s) return false;
  return /(^users\/|^gs:\/\/|\/)/i.test(s);
}
function toDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === "object" && typeof v.seconds === "number") {
    return new Date(v.seconds * 1000);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function displayCloneName(
  d: any,
  index: number,
  t: (k: string, v?: any) => string
) {
  const human =
    d?.titulo || d?.title || d?.name || d?.displayName || d?.filename;
  if (typeof human === "string" && human.trim() && !looksLikeStoragePath(human))
    return human.trim();

  const dts =
    toDate(d?.createdAt) ||
    toDate(d?.uploadedAt) ||
    toDate(d?.timestamp) ||
    null;
  if (dts) {
    // Usa el locale del navegador/entorno en vez de fijar "es-ES"
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(dts);
  }
  return t("wizard.video.fallbackName", { n: index + 1 });
}

export default function CreateReelWizard({ onComplete }: CreateReelWizardProps) {
  const t = useT();

  // Helpers que dependen de t()
  const toneLabel = (k?: string) =>
    k ? (t(`wizard.toneOptions.${k}`) ?? k) : "";
  const structureLabel = (k?: string) =>
    k ? (t(`wizard.structureOptions.${k}`) ?? k) : "";
  const uiLangLabel = (code?: string) =>
    code
      ? t(`scriptsForm.options.languages.${code}`) ?? code.toUpperCase()
      : "—";

  // Si llega una etiqueta (no key), intenta mapearla a key en el locale actual; si falla, usa defaults
  const toneToKey = (value: string): ToneKey =>
    (TONE_KEYS.find((k) => t(`wizard.toneOptions.${k}`) === value) ??
      (TONE_KEYS.includes(value as any) ? (value as ToneKey) : TONE_KEYS[0])) as ToneKey;

  const structureToKey = (value: string): StructureKey =>
    (STRUCTURE_KEYS.find((k) => t(`wizard.structureOptions.${k}`) === value) ??
      (STRUCTURE_KEYS.includes(value as any)
        ? (value as StructureKey)
        : STRUCTURE_KEYS[0])) as StructureKey;

  // Si el valor ya es key, devuelve etiqueta traducida; si ya es etiqueta, devuélvela tal cual
  const toneToLabel = (value: string) =>
    TONE_KEYS.includes(value as any) ? toneLabel(value) : value;

  const structureToLabel = (value: string) =>
    STRUCTURE_KEYS.includes(value as any) ? structureLabel(value) : value;

  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [modalType, setModalType] = useState<"main" | "script" | "audio">("main");

  // 🏷️ SOLO PARA EL AUDIO DEL WIZARD
  const [audioTitle, setAudioTitle] = useState("");

  // Paso 1 - Guion
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<string>(""); // guarda KEY o etiqueta (compat)
  const [platform, setPlatform] = useState("");
  const [duration, setDuration] = useState("");
  const [language, setLanguage] = useState("es");
  const [structure, setStructure] = useState<string>(""); // guarda KEY o etiqueta (compat)
  const [addCTA, setAddCTA] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState("");

  // Paso 2 - Audio
  const audioForm = useAudioForm("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);

  // Paso 3 - Vídeos clonación
  const [videos, setVideos] = useState<{ id: string; name: string; url: string }[]>(
    []
  );
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Regens
  const [scriptRegens, setScriptRegens] = useState(0);
  const [audioRegens, setAudioRegens] = useState(0);

  const [showCheckout, setShowCheckout] = useState(false);
  const { ensureSubscribed } = useSubscriptionGate();

  // ==== Mini-diálogo Script ====
  const [regenScriptOpen, setRegenScriptOpen] = useState(false);
  const [regenTone, setRegenTone] = useState<ToneKey>(TONE_KEYS[0]);
  const [regenStructure, setRegenStructure] = useState<StructureKey>(STRUCTURE_KEYS[0]);

  // ==== Mini-diálogo Audio ====
  const [regenAudioOpen, setRegenAudioOpen] = useState(false);
  const [rText, setRText] = useState("");
  const [rVoiceId, setRVoiceId] = useState("");
  const [rStability, setRStability] = useState(0.5);
  const [rSimilarity, setRSimilarity] = useState(0.75);
  const [rStyle, setRStyle] = useState(0);
  const [rSpeed, setRSpeed] = useState(1);
  const [rSpeakerBoost, setRSpeakerBoost] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    track("wizard_opened");
    return () => unsub();
  }, []);

  useEffect(() => {
    track("wizard_step_viewed", { step, modalType });
  }, [step, modalType]);

  // ------------------- Paso 1: Guion -------------------
  const generateScript = async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) {
      setShowCheckout(true);
      track("subscription_gate_blocked", { feature: "reel", step: "script" });
      return;
    }
    if (!description || !tone || !platform || !duration || !structure) {
      toast.error(t("wizard.errors.fillAll"));
      track("script_generate_validation_error");
      return;
    }
    if (!user) {
      toast.error(t("wizard.errors.mustLogin"));
      track("script_generate_noauth");
      return;
    }
    const loadingId = toast.loading(t("wizard.script.generate.loading"));
    setLoading(true);
    track("script_generate_clicked", {
      tone,
      platform,
      duration,
      language,
      structure,
      addCTA: !!addCTA,
    });

    try {
      const token = await user.getIdToken();

      // Convertimos posibles KEYS a etiquetas traducidas para el backend
      const toneOut = toneToLabel(tone);
      const structureOut = structureToLabel(structure);

      const res = await withTiming("script_generate", async () =>
        fetch("/api/chatgpt/scripts/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            description,
            tone: toneOut,
            platform,
            duration,
            language,
            structure: structureOut,
            addCTA,
            ctaText,
          }),
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error generando guion");
      setScript(parsed.script || "");
      setModalType("script");
      toast.success(t("wizard.script.generate.success"), { id: loadingId });
      track("script_generate_succeeded", { length: (parsed.script || "").length });
    } catch (err: any) {
      console.error(err);
      toast.error(t("wizard.script.generate.error"), { id: loadingId });
      track("script_generate_failed", { error: String(err?.message || err) });
    } finally {
      setLoading(false);
    }
  };

  const openScriptRegenDialog = () => {
    if (scriptRegens >= 2) {
      toast.error(t("wizard.script.regen.limit"));
      track("script_regenerate_limit_reached");
      return;
    }
    // Si venían etiquetas (no keys), intenta mapear; si no, usa defaults
    setRegenTone(tone ? toneToKey(tone) : TONE_KEYS[0]);
    setRegenStructure(structure ? structureToKey(structure) : STRUCTURE_KEYS[0]);
    setRegenScriptOpen(true);
  };

  const doRegenerateScript = async (toneOverrideKey: string, structureOverrideKey: string) => {
    const loadingId = toast.loading(t("wizard.script.regen.loading"));
    try {
      const token = await user?.getIdToken();

      const toneOut = toneToLabel(toneOverrideKey);
      const structureOut = structureToLabel(structureOverrideKey);

      const res = await withTiming("script_regenerate", async () =>
        fetch("/api/chatgpt/scripts/regenerate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            description,
            tone: toneOut,
            platform,
            duration,
            language,
            structure: structureOut,
            addCTA,
            ctaText,
          }),
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando guion");
      setScript(parsed.script || "");

      // En estado guardamos la KEY (mejor para i18n)
      setTone(toneOverrideKey);
      setStructure(structureOverrideKey);

      setScriptRegens((c) => c + 1);
      toast.success(t("wizard.script.regen.success"), { id: loadingId });
      track("script_regenerate_succeeded", { length: (parsed.script || "").length });
    } catch (err: any) {
      console.error(err);
      toast.error(t("wizard.script.regen.error"), { id: loadingId });
      track("script_regenerate_failed", { error: String(err?.message || err) });
    }
  };

  const acceptScript = () => {
    audioForm.setText(script);
    toast.success(t("wizard.script.accepted"));
    track("script_accepted", { length: script.length });
    setModalType("main");
    setStep(2);
  };

  // ------------------- Paso 2: Audio -------------------
  const generateAudio = async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) {
      setShowCheckout(true);
      track("subscription_gate_blocked", { feature: "reel", step: "audio" });
      return;
    }
    if (!audioForm.voiceId) {
      toast.error(t("wizard.errors.selectVoiceFirst"));
      track("audio_generate_validation_error");
      return;
    }
    if (!user) {
      toast.error(t("wizard.errors.mustLoginShort"));
      track("audio_generate_noauth");
      return;
    }
    const loadingId = toast.loading(t("wizard.audio.generate.loading"));
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
              speed: clampSpeed(audioForm.speed),
              use_speaker_boost: audioForm.speakerBoost,
            },
            name: audioTitle?.trim() || undefined,
            title: audioTitle?.trim() || undefined,
          }),
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error generando audio");
      setAudioUrl(parsed.audioUrl || null);
      setAudioId(parsed.audioId || null);
      setModalType("audio");
      toast.success(t("wizard.audio.generate.success"), { id: loadingId });
      track("audio_generate_succeeded", { audioId: parsed.audioId ? "yes" : "no" });
    } catch (err: any) {
      console.error(err);
      toast.error(t("wizard.audio.generate.error"), { id: loadingId });
      track("audio_generate_failed", { error: String(err?.message || err) });
    } finally {
      audioForm.setLoading(false);
    }
  };

  const openAudioRegenDialog = () => {
    if (!audioId) {
      toast.error(t("wizard.audio.regen.noBase"));
      track("audio_regenerate_no_base");
      return;
    }
    if (audioRegens >= 2) {
      toast.error(t("wizard.audio.regen.limit"));
      track("audio_regenerate_limit_reached");
      return;
    }
    setRText(audioForm.text);
    setRVoiceId(audioForm.voiceId);
    setRStability(audioForm.stability);
    setRSimilarity(audioForm.similarityBoost);
    setRStyle(audioForm.style);
    setRSpeed(audioForm.speed);
    setRSpeakerBoost(audioForm.speakerBoost);
    setRegenAudioOpen(true);
  };

  const doRegenerateAudio = async () => {
    const token = await user?.getIdToken();
    const loadingId = toast.loading(t("wizard.audio.regen.loading"));

    const clamped = clampSpeed(rSpeed);
    if (clamped !== rSpeed) {
      toast.message(t("wizard.audio.regen.adjustSpeed"));
      setRSpeed(clamped);
    }

    try {
      const res = await withTiming("audio_regenerate", async () =>
        fetch("/api/elevenlabs/audio/regenerate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            parentAudioId: audioId,
            text: rText,
            voiceId: rVoiceId,
            voice_settings: {
              stability: rStability,
              similarity_boost: rSimilarity,
              style: rStyle,
              speed: clamped,
              use_speaker_boost: rSpeakerBoost,
            },
          }),
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando audio");
      setAudioUrl(parsed.audioUrl || null);

      audioForm.setText(rText);
      audioForm.setVoiceId(rVoiceId);
      audioForm.setStability(rStability);
      audioForm.setSimilarityBoost(rSimilarity);
      audioForm.setStyle(rStyle);
      audioForm.setSpeed(clamped);
      audioForm.setSpeakerBoost(rSpeakerBoost);

      setAudioRegens((c) => c + 1);
      toast.success(t("wizard.audio.regen.success"), { id: loadingId });
      track("audio_regenerate_succeeded");
    } catch (err: any) {
      console.error(err);
      toast.error(t("wizard.audio.regen.error"), { id: loadingId });
      track("audio_regenerate_failed", { error: String(err?.message || err) });
    }
  };

  const acceptAudio = () => {
    toast.success(t("wizard.audio.accepted"));
    track("audio_accepted", { hasAudio: !!audioUrl });
    setModalType("main");
    setStep(3);
    void loadClonacionVideos();
  };

  // ------------------- Paso 3 -------------------
  const loadClonacionVideos = async () => {
    if (!user) return;
    setLoadingVideos(true);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/firebase/users/${user.uid}/clones`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Error al cargar vídeos de clonación");
      const data = await res.json();

      const list = (data || []).map((d: any, i: number) => ({
        id: d.id,
        name: displayCloneName(d, i, t),
        url: d.url ?? d.downloadUrl ?? "",
      }));

      setVideos(list);
      track("clonacion_videos_loaded", { count: list.length });
    } catch (err) {
      console.error(err);
      toast.error(t("wizard.video.loadError"));
      track("clonacion_videos_load_failed", { error: String(err) });
    } finally {
      setLoadingVideos(false);
    }
  };

  const steps = [
    t("wizard.steps.script"),
    t("wizard.steps.audio"),
    t("wizard.steps.video"),
  ];

  return (
    <div className="w-full max-w-4xl mx-auto rounded-xl shadow p-4 sm:p-6 bg-white dark:bg-neutral-900 transition-colors overflow-y-auto">
      {/* Stepper */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        {steps.map((label, i) => {
          const current = i + 1 === step;
          const completed = i + 1 < step;
          return (
            <div key={`${label}-${i}`} className="flex items-center flex-1 min-w-[100px]">
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
            tone={tone}                // <-- KEY o etiqueta (compat)
            platform={platform}
            duration={duration}
            language={language}
            structure={structure}      // <-- KEY o etiqueta (compat)
            addCTA={addCTA}
            ctaText={ctaText}
            loading={loading}
            setDescription={(v) => {
              setDescription(v);
              track("script_description_changed");
            }}
            setTone={(v) => {
              setTone(v); // Ideal: que ScriptForm envíe la KEY
              track("script_tone_changed", { tone: v });
            }}
            setPlatform={(v) => {
              setPlatform(v);
              track("script_platform_changed", { platform: v });
            }}
            setDuration={(v) => {
              setDuration(v);
              track("script_duration_changed", { duration: v });
            }}
            setLanguage={(v) => {
              setLanguage(v);
              track("script_language_changed", { language: v });
            }}
            setStructure={(v) => {
              setStructure(v); // Ideal: que ScriptForm envíe la KEY
              track("script_structure_changed", { structure: v });
            }}
            setAddCTA={(v) => {
              setAddCTA(v);
              track("script_cta_toggled", { enabled: v });
            }}
            setCtaText={(v) => {
              setCtaText(v);
              track("script_cta_text_changed");
            }}
            onSubmit={generateScript}
          />
          <div className="flex flex-col sm:flex-row justify-start mt-6 gap-2">
            <Button
              variant="outline"
              disabled
              onClick={() => track("wizard_back_disabled")}
            >
              {t("common.back")}
            </Button>
          </div>
        </>
      )}

      {/* Paso 2 */}
      {modalType === "main" && step === 2 && (
        <>
          <AudioForm
            {...audioForm}
            title={audioTitle}
            setTitle={setAudioTitle}
            onGenerate={generateAudio}
          />
          <div className="flex flex-col sm:flex-row justify-start mt-6 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep(1);
                track("wizard_back_clicked", { to: 1 });
              }}
            >
              {t("common.back")}
            </Button>
          </div>
        </>
      )}

      {/* Paso 3 */}
      {modalType === "main" && step === 3 && (
        <>
          {loadingVideos ? (
            <p className="text-gray-600 dark:text-gray-300">
              {t("wizard.video.loading")}
            </p>
          ) : (
            <CreatePipelineVideoPage
              preloadedVideos={videos}
              audioUrl={audioUrl!}
              onComplete={() => {
                track("wizard_completed");
                toast.success(t("wizard.video.pipelineSuccess"));
                router.push("/dashboard/edit");
              }}
            />
          )}
          <div className="flex flex-col sm:flex-row justify-start mt-6 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep(2);
                track("wizard_back_clicked", { to: 2 });
              }}
            >
              {t("common.back")}
            </Button>
          </div>
        </>
      )}

      {/* Guion generado */}
      {modalType === "script" && (
        <div>
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">
            {t("wizard.script.modal.title")}
          </h2>
          <Textarea
            value={script}
            onChange={(e) => {
              setScript(e.target.value);
              track("script_edited_manual");
            }}
            className="min-h-[200px] w-full resize-none"
          />
          <div className="flex flex-col sm:flex-row justify-between mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModalType("main");
                track("script_modal_back");
              }}
            >
              {t("common.back")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={openScriptRegenDialog}
                disabled={scriptRegens >= 2}
              >
                {t("common.regenerate")} ({scriptRegens}/2)
              </Button>
              <Button onClick={acceptScript}>{t("wizard.script.modal.accept")}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Audio generado */}
      {modalType === "audio" && (
        <div>
          <h2 className="font-semibold mb-2 text-gray-900 dark:text-white">
            {t("wizard.audio.modal.title")}
          </h2>
          {audioUrl ? (
            <audio
              controls
              src={audioUrl}
              className="w-full my-4"
              onPlay={() => track("audio_preview_play")}
              onEnded={() => track("audio_preview_end")}
            />
          ) : (
            <p className="text-gray-600 dark:text-gray-300">
              {t("wizard.audio.modal.empty")}
            </p>
          )}
          <div className="flex flex-col sm:flex-row justify-between mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setModalType("main");
                track("audio_modal_back");
              }}
            >
              {t("common.back")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={openAudioRegenDialog}
                disabled={audioRegens >= 2}
              >
                {t("common.regenerate")} ({audioRegens}/2)
              </Button>
              <Button onClick={acceptAudio}>{t("wizard.audio.modal.accept")}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Mini-diálogo REGEN SCRIPT ====== */}
      <Dialog open={regenScriptOpen} onOpenChange={setRegenScriptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("wizard.regenScript.title")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">
                {t("wizard.regenScript.toneLabel")}
              </div>
              <Select value={regenTone} onValueChange={(v) => setRegenTone(v as ToneKey)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("wizard.regenScript.tonePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {TONE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {toneLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">
                {t("wizard.regenScript.structureLabel")}
              </div>
              <Select
                value={regenStructure}
                onValueChange={(v) => setRegenStructure(v as StructureKey)}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("wizard.regenScript.structurePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {structureLabel(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenScriptOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={async () => {
                setRegenScriptOpen(false);
                await doRegenerateScript(regenTone, regenStructure);
              }}
            >
              {t("common.acceptAndRegenerate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Mini-diálogo REGEN AUDIO ====== */}
      <Dialog open={regenAudioOpen} onOpenChange={setRegenAudioOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("wizard.regenAudio.title")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Texto */}
            <div>
              <Label className="text-sm font-medium" htmlFor="r-text">
                {t("wizard.regenAudio.textLabel")}
              </Label>
              <Textarea
                id="r-text"
                value={rText}
                onChange={(e) => setRText(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            {/* Voz (idioma fijo visible como info) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium" htmlFor="r-voice">
                  {t("wizard.regenAudio.voiceLabel")}
                </Label>
                <Select value={rVoiceId} onValueChange={setRVoiceId}>
                  <SelectTrigger id="r-voice">
                    <SelectValue placeholder={t("wizard.regenAudio.voicePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(audioForm.voices || []).map((v: any) => {
                      const id = getVoiceId(v);
                      return (
                        <SelectItem key={id} value={id}>
                          {v.name || v.display_name || id}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">
                  {t("wizard.regenAudio.languageLabel")}
                </Label>
                <div className="mt-2 text-sm text-muted-foreground">
                  {uiLangLabel(audioForm.languageCode)}
                </div>
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <Label>{t("wizard.regenAudio.stabilityLabel")}</Label>
                  <span className="text-sm text-muted-foreground">
                    {rStability.toFixed(2)} / 1.00
                  </span>
                </div>
                <Slider
                  value={[rStability]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) => setRStability(v)}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <Label>{t("wizard.regenAudio.similarityLabel")}</Label>
                  <span className="text-sm text-muted-foreground">
                    {rSimilarity.toFixed(2)} / 1.00
                  </span>
                </div>
                <Slider
                  value={[rSimilarity]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) => setRSimilarity(v)}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <Label>{t("wizard.regenAudio.styleLabel")}</Label>
                  <span className="text-sm text-muted-foreground">
                    {rStyle.toFixed(2)} / 1.00
                  </span>
                </div>
                <Slider
                  value={[rStyle]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={([v]) => setRStyle(v)}
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <Label>{t("wizard.regenAudio.speedLabel")}</Label>
                  <span className="text-sm text-muted-foreground">
                    {rSpeed.toFixed(2)} / 2.00
                  </span>
                </div>
                <Slider
                  value={[rSpeed]}
                  min={0.5}
                  max={2}
                  step={0.01}
                  onValueChange={([v]) => setRSpeed(v)}
                />
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("wizard.regenAudio.speedHint")}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="r-sb"
                  checked={rSpeakerBoost}
                  onCheckedChange={(c) => setRSpeakerBoost(!!c)}
                />
                <Label htmlFor="r-sb">{t("wizard.regenAudio.speakerBoost")}</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenAudioOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={async () => {
                if (!rText.trim()) {
                  toast.error(t("wizard.errors.textRequired"));
                  return;
                }
                if (!rVoiceId) {
                  toast.error(t("wizard.errors.voiceRequired"));
                  return;
                }
                setRegenAudioOpen(false);
                await doRegenerateAudio();
              }}
            >
              {t("common.acceptAndRegenerate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message={t("dashboard.checkout.voiceCloneMessage")}
      />
    </div>
  );
}
