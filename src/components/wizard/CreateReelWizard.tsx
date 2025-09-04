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

// === Opciones iguales a ScriptCreatorContainer ===
const TONE_OPTIONS = [
  "Motivador",
  "Educativo",
  "Humorístico",
  "Serio",
  "Inspirador",
  "Emocional",
  "Provocador",
];

const STRUCTURE_OPTIONS = [
  "Gancho – Desarrollo – Cierre",
  "Storytelling",
  "Lista de tips",
  "Pregunta retórica",
  "Comparativa antes/después",
  "Mito vs realidad",
  "Problema – Solución",
  "Testimonio",
];

// === Helper para voces (id puede venir como id o voice_id) ===
const getVoiceId = (v: any) => v?.voice_id ?? v?.id ?? "";

const SPEED_MIN = 0.7;
const SPEED_MAX = 1.2;
const clampSpeed = (x: number) =>
  Math.min(SPEED_MAX, Math.max(SPEED_MIN, Number.isFinite(x) ? x : 1));

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
  const [videos, setVideos] = useState<
    { id: string; name: string; url: string }[]
  >([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Regens
  const [scriptRegens, setScriptRegens] = useState(0);
  const [audioRegens, setAudioRegens] = useState(0);

  const [showCheckout, setShowCheckout] = useState(false);
  const { ensureSubscribed } = useSubscriptionGate();

  // ==== Mini-diálogo Script ====
  const [regenScriptOpen, setRegenScriptOpen] = useState(false);
  const [regenTone, setRegenTone] = useState("");
  const [regenStructure, setRegenStructure] = useState("");

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
      const res = await withTiming("script_generate", async () =>
        fetch("/api/ai/scripts/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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

  const openScriptRegenDialog = () => {
    if (scriptRegens >= 2) {
      toast.error("⚠️ Ya has regenerado el guion 2 veces.");
      track("script_regenerate_limit_reached");
      return;
    }
    setRegenTone(tone || TONE_OPTIONS[0]);
    setRegenStructure(structure || STRUCTURE_OPTIONS[0]);
    setRegenScriptOpen(true);
  };

  const doRegenerateScript = async (toneOverride: string, structureOverride: string) => {
    const loadingId = toast.loading("🔄 Regenerando guion...");
    try {
      const token = await user?.getIdToken();
      const res = await withTiming("script_regenerate", async () =>
        fetch("/api/ai/scripts/regenerate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            description,
            tone: toneOverride,
            platform,
            duration,
            language,
            structure: structureOverride,
            addCTA,
            ctaText,
          }),
        })
      );
      const parsed = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(parsed.error || "Error regenerando guion");
      setScript(parsed.script || "");
      setTone(toneOverride);
      setStructure(structureOverride);
      setScriptRegens((c) => c + 1);
      toast.success(`✅ Guion regenerado`, { id: loadingId });
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

  // ------------------- Paso 2: Audio -------------------
  const generateAudio = async () => {
    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) {
      setShowCheckout(true);
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
        fetch("/api/audio/create", {
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

  const openAudioRegenDialog = () => {
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
    const loadingId = toast.loading("🔄 Regenerando audio...");

    const clamped = clampSpeed(rSpeed);
    if (clamped !== rSpeed) {
      toast.message("⚙️ Ajustamos la velocidad al rango permitido (0.7–1.2).");
      setRSpeed(clamped);
    }

    try {
      const res = await withTiming("audio_regenerate", async () =>
        fetch("/api/audio/regenerate", {
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
      const list = data.map((d: any) => ({
        id: d.id,
        name: d.titulo ?? d.id,
        url: d.url ?? "",
      }));
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
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
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
              <Button variant="outline" onClick={openScriptRegenDialog} disabled={scriptRegens >= 2}>
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
              <Button variant="outline" onClick={openAudioRegenDialog} disabled={audioRegens >= 2}>
                Regenerar ({audioRegens}/2)
              </Button>
              <Button onClick={acceptAudio}>Aceptar audio</Button>
            </div>
          </div>
        </div>
      )}

      {/* ====== Mini-diálogo REGEN SCRIPT ====== */}
      <Dialog open={regenScriptOpen} onOpenChange={setRegenScriptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modificar antes de regenerar</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-1">Tono</div>
              <Select value={regenTone} onValueChange={setRegenTone}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona tono" />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Estructura</div>
              <Select value={regenStructure} onValueChange={setRegenStructure}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estructura" />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenScriptOpen(false)}>Cancelar</Button>
            <Button onClick={async () => { setRegenScriptOpen(false); await doRegenerateScript(regenTone, regenStructure); }}>
              Aceptar y regenerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Mini-diálogo REGEN AUDIO ====== */}
      <Dialog open={regenAudioOpen} onOpenChange={setRegenAudioOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modificar parámetros antes de regenerar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium" htmlFor="r-text">Texto *</Label>
              <Textarea id="r-text" value={rText} onChange={(e) => setRText(e.target.value)} className="min-h-[100px]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium" htmlFor="r-voice">Voz *</Label>
                <Select value={rVoiceId} onValueChange={setRVoiceId}>
                  <SelectTrigger id="r-voice">
                    <SelectValue placeholder="Selecciona una voz" />
                  </SelectTrigger>
                  <SelectContent>
                    {(audioForm.voices || []).map((v: any) => {
                      const id = getVoiceId(v);
                      return <SelectItem key={id} value={id}>{v.name || v.display_name || id}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium">Idioma</Label>
                <div className="mt-2 text-sm text-muted-foreground">
                  {audioForm.languageCode === "es" ? "Español" : audioForm.languageCode?.toUpperCase() || "—"}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1"><Label>Estabilidad</Label><span>{rStability.toFixed(2)} / 1.00</span></div>
                <Slider value={[rStability]} min={0} max={1} step={0.01} onValueChange={([v]) => setRStability(v)} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><Label>Similaridad</Label><span>{rSimilarity.toFixed(2)} / 1.00</span></div>
                <Slider value={[rSimilarity]} min={0} max={1} step={0.01} onValueChange={([v]) => setRSimilarity(v)} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><Label>Estilo</Label><span>{rStyle.toFixed(2)} / 1.00</span></div>
                <Slider value={[rStyle]} min={0} max={1} step={0.01} onValueChange={([v]) => setRStyle(v)} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><Label>Velocidad</Label><span>{rSpeed.toFixed(2)} / 2.00</span></div>
                <Slider value={[rSpeed]} min={0.5} max={2} step={0.01} onValueChange={([v]) => setRSpeed(v)} />
                <div className="mt-1 text-xs text-muted-foreground">Acepta 0.7–1.2. Ajustaremos automáticamente si sales de ese rango.</div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="r-sb" checked={rSpeakerBoost} onCheckedChange={(c) => setRSpeakerBoost(!!c)} />
                <Label htmlFor="r-sb">Usar Speaker Boost</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenAudioOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!rText.trim()) { toast.error("El texto no puede estar vacío"); return; }
              if (!rVoiceId) { toast.error("Debes seleccionar una voz"); return; }
              setRegenAudioOpen(false); await doRegenerateAudio();
            }}>
              Aceptar y regenerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Para clonar tu voz necesitas suscripción activa, empieza tu prueba GRATUITA de 7 días"
      />
    </div>
  );
}
