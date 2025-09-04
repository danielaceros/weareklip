// src/app/dashboard/edit/CreatePipelineVideoPage.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, VideoIcon } from "lucide-react";
import { auth } from "@/lib/firebase";
import { uploadVideo } from "@/lib/uploadVideo";
import { v4 as uuidv4 } from "uuid";
import { useDropzone } from "react-dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";
import { track } from "@/lib/analytics-events";

// -------- utilidades --------
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function hasString(v: unknown, key: string): v is Record<string, string> {
  return isRecord(v) && typeof v[key] === "string";
}
const stripExt = (name?: string) => (name || "").replace(/\.[^/.]+$/, "");

// -----------------------------
const MAX_SEC = 60;

const getVideoDurationFromUrl = (url: string) =>
  new Promise<number>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () =>
      reject(new Error("No se pudo leer la duración del vídeo"));
  });

const getVideoDurationFromFile = async (file: File) => {
  const url = URL.createObjectURL(file);
  try {
    const sec = await getVideoDurationFromUrl(url);
    return sec;
  } finally {
    URL.revokeObjectURL(url);
  }
};

type VideoOption = { id: string; name: string; url: string };

export interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  storagePath?: string;
  duration?: number;
  completedAt?: string;
}

type OptimisticVideoData = VideoData & {
  _optimistic?: boolean;
  _rollback?: boolean;
};

interface Props {
  preloadedVideos?: VideoOption[];
  audioUrl: string; // obligatorio
  onComplete?: () => void;
  onCreated?: (video?: OptimisticVideoData) => void;
}

export default function CreatePipelineVideoPage({
  preloadedVideos = [],
  audioUrl,
  onComplete,
  onCreated,
}: Props) {
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoSec, setVideoSec] = useState<number | null>(null);

  // 🏷️ TÍTULO DEL REEL (opcional)
  const [videoTitle, setVideoTitle] = useState("");

  const [language, setLanguage] = useState("");
  const [template, setTemplate] = useState("");
  const [dictionary, setDictionary] = useState("");
  const [magicZooms, setMagicZooms] = useState(false);
  const [magicBrolls, setMagicBrolls] = useState(false);
  const [magicBrollsPercentage, setMagicBrollsPercentage] = useState(50);

  const [languages, setLanguages] = useState<{ name: string; code: string }[]>(
    []
  );
  const [templates, setTemplates] = useState<string[]>([]);
  const [loadingLang, setLoadingLang] = useState(true);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { ensureSubscribed } = useSubscriptionGate();

  /* ---- Dropzone ---- */
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const f = acceptedFiles[0];
      if (!f) return;
      try {
        const sec = await getVideoDurationFromFile(f);
        if (!sec) {
          toast.error("No se pudo leer la duración del vídeo.");
          return;
        }
        if (sec > MAX_SEC) {
          toast.error(
            `⏱️ El vídeo dura ${Math.round(sec)}s y el máximo es ${MAX_SEC}s.`
          );
          return;
        }
        setFile(f);
        setVideoSec(sec);
        setVideoUrl(null);
        // sugerimos título si está vacío
        if (!videoTitle.trim()) setVideoTitle(stripExt(f.name));
        toast.success(`📹 Vídeo "${f.name}" cargado`);
        track("video_uploaded", { fileName: f.name, seconds: Math.round(sec) });
      } catch {
        toast.error("❌ No se pudo analizar el vídeo.");
      }
    },
    [videoTitle]
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    disabled: !!videoUrl,
  });

  /* ---- cargar idiomas/templates ---- */
  useEffect(() => {
    fetch("/api/submagic/languages")
      .then((res) => res.json())
      .then((data) => setLanguages(data.languages || []))
      .catch(() => toast.error("❌ Error cargando idiomas"))
      .finally(() => setLoadingLang(false));

    fetch("/api/submagic/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => toast.error("❌ Error cargando templates"))
      .finally(() => setLoadingTpl(false));
  }, []);

  const handleSubmit = async () => {
    flushSync(() => setProcessing(true));

    const ok = await ensureSubscribed({ feature: "reel" });
    if (!ok) {
      setProcessing(false);
      setShowCheckout(true);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      toast.error("⚠️ Debes iniciar sesión");
      setProcessing(false);
      return;
    }

    if (!videoUrl && !file && preloadedVideos.length === 0) {
      toast.error("⚠️ Debes subir o seleccionar un vídeo");
      setProcessing(false);
      return;
    }
    if (!language) {
      toast.error("⚠️ Debes seleccionar un idioma");
      setProcessing(false);
      return;
    }

    // Validación de duración
    try {
      let sec = videoSec;
      if (sec == null) {
        if (videoUrl) {
          sec = await getVideoDurationFromUrl(videoUrl).catch(() => 0);
        } else if (file) {
          sec = await getVideoDurationFromFile(file).catch(() => 0);
        }
      }
      if (!sec) {
        toast.error("No se pudo leer la duración del vídeo.");
        setProcessing(false);
        return;
      }
      if (sec > MAX_SEC) {
        toast.error(
          `⏱️ Máximo ${MAX_SEC}s. Este vídeo dura ${Math.round(sec)}s.`
        );
        setProcessing(false);
        return;
      }
    } catch {
      toast.error("No se pudo validar la duración del vídeo.");
      setProcessing(false);
      return;
    }

    // 🏷️ Título final
    const finalTitle =
      videoTitle.trim() ||
      stripExt(file?.name) ||
      preloadedVideos[0]?.name ||
      "video-preloaded";

    // ---- Optimistic UI ----
    if (onCreated) {
      const tempVideo: OptimisticVideoData = {
        projectId: uuidv4(),
        title: finalTitle,
        status: "processing",
        downloadUrl: videoUrl || preloadedVideos[0]?.url,
        _optimistic: true,
      };
      onCreated(tempVideo);
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      let finalVideoUrl = videoUrl;
      if (!finalVideoUrl && file) {
        toast("☁️ Subiendo vídeo a la nube...");
        const { downloadURL } = await uploadVideo(
          file,
          user.uid,
          setUploadProgress
        );
        finalVideoUrl = downloadURL;
        track("video_uploaded_cloud", { url: downloadURL });
      }
      if (!finalVideoUrl)
        throw new Error("No se pudo obtener la URL del vídeo");

      toast("⚙️ Procesando tu reel...");
      const idToken = await user.getIdToken(true);
      const idem = uuidv4();

      const res = await fetch("/api/sync/pipeline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Idempotency-Key": idem,
        },
        body: JSON.stringify({
          title: finalTitle, // ⬅️ enviamos el título
          audioUrl,
          videoUrl: finalVideoUrl,
          subLang: language,
          template: template || undefined,
          dictionary: dictionary || undefined,
          magicZooms,
          magicBrolls,
          magicBrollsPercentage,
        }),
      });

      if (!res.ok) {
        if (onCreated) onCreated(undefined); // rollback
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }

      toast.success("🎬 Reel enviado al pipeline correctamente");
      track("pipeline_reel_submitted", {
        title: finalTitle,
        language,
        template,
        magicZooms,
        magicBrolls,
        magicBrollsPercentage,
      });

      if (onComplete) onComplete();
      router.push("/dashboard/edit");
    } catch (error) {
      console.error(error);
      toast.error("❌ Error en el pipeline");
      track("pipeline_error", { error: String(error) });
    } finally {
      setSubmitting(false);
      setProcessing(false);
    }
  };

  const isLoading = processing || submitting;
  const buttonText = isLoading ? "Generando..." : "Crear Reel";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Título */}
      <div className="lg:col-span-2 mb-2 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">
          🎬 Crear Reel con Pipeline
        </h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Sube o selecciona un vídeo y combínalo con tu audio para enviarlo al
          pipeline.
        </p>
      </div>

      {/* IZQUIERDA */}
      <div className="flex flex-col gap-3 sm:gap-4 items-center">
        {preloadedVideos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 w-full">
            {preloadedVideos.map((v) => (
              <div
                key={v.id}
                onClick={async () => {
                  try {
                    const sec = await getVideoDurationFromUrl(v.url);
                    if (!sec) {
                      toast.error("No se pudo leer la duración del vídeo.");
                      return;
                    }
                    if (sec > MAX_SEC) {
                      toast.error(
                        `⏱️ El vídeo dura ${Math.round(
                          sec
                        )}s y el máximo es ${MAX_SEC}s.`
                      );
                      return;
                    }
                    setVideoUrl(v.url);
                    setVideoSec(sec);
                    // sugerimos título si no hay
                    if (!videoTitle.trim()) setVideoTitle(v.name);
                    toast.success(`🎥 Vídeo "${v.name}" seleccionado`);
                    track("video_selected", {
                      name: v.name,
                      seconds: Math.round(sec),
                    });
                  } catch {
                    toast.error("❌ No se pudo analizar el vídeo.");
                  }
                }}
                className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                  videoUrl === v.url ? "ring-2 ring-blue-500" : ""
                }`}
              >
                <video
                  src={v.url}
                  className="w-full h-32 sm:h-40 object-cover"
                  muted
                  loop
                  playsInline
                />
                <div className="p-2 text-xs sm:text-sm font-medium truncate">
                  {v.name}
                </div>
              </div>
            ))}
          </div>
        ) : videoUrl ? (
          <div className="rounded-xl overflow-hidden border w-full max-w-[260px] sm:max-w-sm aspect-[9/16]">
            <video
              src={videoUrl}
              controls
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center cursor-pointer w-full max-w-[260px] sm:max-w-sm aspect-[9/16] transition ${
              isDragActive
                ? "border-primary bg-muted"
                : "border-muted-foreground/50"
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <>
                <VideoIcon className="w-8 h-8 sm:w-10 sm:h-10 mb-2 text-primary" />
                <p className="text-xs sm:text-sm font-medium text-center">
                  {file.name}
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 mb-2 text-muted-foreground" />
                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                  {isDragActive
                    ? "Suelta el vídeo aquí..."
                    : "Arrastra un vídeo o haz click"}
                </p>
              </>
            )}
          </div>
        )}
        {uploadProgress > 0 && (
          <Progress
            value={uploadProgress}
            className="w-full max-w-[260px] sm:max-w-sm"
          />
        )}
      </div>

      {/* DERECHA */}
      <div className="space-y-4 sm:space-y-6">
        {/* 🏷️ Título del reel */}
        <div>
          <Label className="mb-1 sm:mb-2 block text-sm">
            Título (opcional)
          </Label>
          <Input
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="Ej: Demo features – vertical"
            maxLength={80}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Si lo dejas vacío usaremos el nombre del archivo o
            “video-preloaded”.
          </p>
        </div>

        {/* Templates */}
        <div>
          <Label className="mb-1 sm:mb-2 block text-sm">Template</Label>
          {loadingTpl ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="animate-spin h-4 w-4" /> Cargando templates...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {templates.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={t === template ? "default" : "secondary"}
                  className="w-full text-xs sm:text-sm"
                  onClick={() => {
                    setTemplate(t);
                    toast.success(`📑 Template "${t}" seleccionado`);
                    track("template_selected", { template: t });
                  }}
                >
                  {t}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Idioma */}
        <div>
          <Label className="mb-1 sm:mb-2 block text-sm">Idioma</Label>
          {loadingLang ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="animate-spin h-4 w-4" /> Cargando idiomas...
            </div>
          ) : (
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Seleccionar un idioma" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Descripción breve */}
        <div>
          <Label className="mb-1 sm:mb-2 block text-sm">
            Descripción breve
          </Label>
          <Input
            value={dictionary}
            onChange={(e) => {
              setDictionary(e.target.value);
              track("dictionary_updated");
            }}
            placeholder="Escribe una breve descripción..."
            className="text-sm"
          />
        </div>

        {/* Opciones mágicas */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={magicZooms}
                    onCheckedChange={(c) => {
                      setMagicZooms(!!c);
                      track("magic_zooms_toggled", { enabled: !!c });
                    }}
                  />
                  <Label className="text-sm">Magic Zooms</Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Agrega acercamientos automáticos para más dinamismo.</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-pointer">
                  <Checkbox
                    checked={magicBrolls}
                    onCheckedChange={(c) => {
                      setMagicBrolls(!!c);
                      track("magic_brolls_toggled", { enabled: !!c });
                    }}
                  />
                  <Label className="text-sm">Magic B-rolls</Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Inserta B-rolls automáticos relevantes en tu vídeo.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {magicBrolls && (
            <div>
              <Label className="mb-1 block text-sm">
                Porcentaje de B-rolls: {magicBrollsPercentage}%
              </Label>
              <Slider
                defaultValue={[magicBrollsPercentage]}
                max={100}
                step={1}
                onValueChange={(v) => setMagicBrollsPercentage(v[0])}
              />
            </div>
          )}
        </div>

        {/* Botón final */}
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full text-sm sm:text-base py-2 sm:py-3"
        >
          {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          {buttonText}
        </Button>
      </div>

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Necesitas una suscripción activa para generar audios."
      />
    </div>
  );
}
