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
import { TemplateSelector } from "./TemplateSelector";
import { useTranslations } from "next-intl"; // ⬅️ i18n

// -------- utilidades --------
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function hasString(v: unknown, key: string): v is Record<string, string> {
  return isRecord(v) && typeof v[key] === "string";
}
// -----------------------------

const MAX_SEC = 60;

const getVideoDurationFromUrl = (url: string) =>
  new Promise<number>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () => reject(new Error("read-duration"));
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
  onCreated?: (video?: OptimisticVideoData) => void; // ✅ corregido para aceptar optimistic
}

export default function CreatePipelineVideoPage({
  preloadedVideos = [],
  audioUrl,
  onComplete,
  onCreated,
}: Props) {
  const router = useRouter();
  const t = useTranslations("pipeline.create"); // ⬅️ i18n namespace

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoSec, setVideoSec] = useState<number | null>(null);

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
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    try {
      const sec = await getVideoDurationFromFile(f);
      if (!sec) {
        toast.error(t("errors.readDuration"));
        return;
      }
      if (sec > MAX_SEC) {
        toast.error(t("errors.maxSeconds", { sec: Math.round(sec), max: MAX_SEC }));
        return;
      }
      setFile(f);
      setVideoSec(sec);
      setVideoUrl(null);
      toast.success(t("toasts.videoLoaded", { name: f.name }));
      track("video_uploaded", { fileName: f.name, seconds: Math.round(sec) });
    } catch {
      toast.error(t("errors.cantAnalyzeVideo"));
    }
  }, [t]);
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
      .catch(() => toast.error(t("errors.loadLangs")))
      .finally(() => setLoadingLang(false));

    fetch("/api/submagic/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => toast.error(t("errors.loadTemplates")))
      .finally(() => setLoadingTpl(false));
  }, [t]);

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
      toast.error(t("errors.mustLogin"));
      setProcessing(false);
      return;
    }

    if (!videoUrl && !file && preloadedVideos.length === 0) {
      toast.error(t("errors.mustUploadOrSelect"));
      setProcessing(false);
      return;
    }
    if (!language) {
      toast.error(t("errors.mustSelectLanguage"));
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
        toast.error(t("errors.readDuration"));
        setProcessing(false);
        return;
      }
      if (sec > MAX_SEC) {
        toast.error(t("errors.maxSecondsAlt", { max: MAX_SEC, sec: Math.round(sec) }));
        setProcessing(false);
        return;
      }
    } catch {
      toast.error(t("errors.durationValidateFail"));
      setProcessing(false);
      return;
    }

    // ---- Optimistic UI ----
    if (onCreated) {
      const tempVideo: OptimisticVideoData = {
        projectId: uuidv4(),
        title: file?.name || "video-preloaded",
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
        toast(t("toasts.uploading"));
        const { downloadURL } = await uploadVideo(
          file,
          user.uid,
          setUploadProgress
        );
        finalVideoUrl = downloadURL;
        track("video_uploaded_cloud", { url: downloadURL });
      }
      if (!finalVideoUrl) throw new Error("no-url");

      toast(t("toasts.processingReel"));
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

      toast.success(t("toasts.pipelineOk"));
      track("pipeline_reel_submitted", {
        language,
        template,
        magicZooms,
        magicBrolls,
        magicBrollsPercentage,
      });

      if (onComplete) onComplete();
      router.push("/dashboard/edit");
    } catch (error: any) {
      toast.error(
        error?.message === "no-url" ? t("errors.noUrl") : t("errors.pipeline")
      );
      track("pipeline_error", { error: String(error) });
    } finally {
      setSubmitting(false);
      setProcessing(false);
    }
  };

  const isLoading = processing || submitting;
  const buttonText = isLoading ? t("ui.buttonGenerating") : t("ui.buttonCreate");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Título */}
      <div className="lg:col-span-2 mb-2 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">{t("header.title")}</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {t("header.subtitle")}
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
                      toast.error(t("errors.readDuration"));
                      return;
                    }
                    if (sec > MAX_SEC) {
                      toast.error(
                        t("errors.maxSeconds", { sec: Math.round(sec), max: MAX_SEC })
                      );
                      return;
                    }
                    setVideoUrl(v.url);
                    setVideoSec(sec);
                    toast.success(t("toasts.videoSelected", { name: v.name }));
                    track("video_selected", {
                      name: v.name,
                      seconds: Math.round(sec),
                    });
                  } catch {
                    toast.error(t("errors.cantAnalyzeVideo"));
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
                  {isDragActive ? t("drop.dropHere") : t("drop.dragOrClick")}
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
        {/* Templates */}
        <div>
          <Label className="mb-1 sm:mb-2 block text-sm">{t("ui.template")}</Label>
          {loadingTpl ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="animate-spin h-4 w-4" /> {t("ui.loadingTemplates")}
            </div>
          ) : (
            <TemplateSelector
              templates={templates}
              selected={template}
              onSelect={(tpl) => {
                setTemplate(tpl);
                track("template_selected", { template: tpl });
              }}
            />
          )}
        </div>

        {/* Idioma */}
        <div>
          <Label className="mb-1 sm:mb-2 block text-sm">{t("ui.language")}</Label>
          {loadingLang ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="animate-spin h-4 w-4" /> {t("ui.loadingLanguages")}
            </div>
          ) : (
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={t("ui.selectLanguage")} />
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

        {/* Diccionario */}
        <div>
          <Label className="mb-1 sm:mb-2 block text-sm">{t("ui.dictionary")}</Label>
          <Input
            value={dictionary}
            onChange={(e) => {
              setDictionary(e.target.value);
              track("dictionary_updated");
            }}
            placeholder={t("ui.dictionaryPlaceholder")}
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
                  <Label className="text-sm">{t("ui.magicZooms")}</Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("ui.magicZoomsTip")}</p>
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
                  <Label className="text-sm">{t("ui.magicBrolls")}</Label>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("ui.magicBrollsTip")}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {magicBrolls && (
            <div>
              <Label className="mb-1 block text-sm">
                {t("ui.brollsPercentage", { value: magicBrollsPercentage })}
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
