// src/app/dashboard/edit/CreateVideoPage.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
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
import { TagsInput } from "../shared/TagsInput";
import { Input } from "@/components/ui/input";
import { TemplateSelector } from "./TemplateSelector";
import { validateFileSizeAs } from "@/lib/fileLimits";
import { VideoData } from "./VideosPage";
import { useTranslations } from "next-intl";

const MAX_SEC = 60; // ⏱️ límite duro

const getVideoDurationFromUrl = (url: string) =>
  new Promise<number>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () => reject(new Error("No se pudo leer la duración del vídeo"));
  });

type VideoOption = { id: string; name: string; url: string };

interface Props {
  preloadedVideos?: VideoOption[];
  onComplete?: (data: {
    selectedVideo: string;
    subLang: string;
    template: string;
    dictionary: string[];
    magicZooms: boolean;
    magicBrolls: boolean;
    magicBrollsPercentage: number;
  }) => void;
  onCreated?: (
    video?: VideoData & { _optimistic?: boolean; _rollback?: boolean }
  ) => void;
}

export default function CreateVideoPage({
  preloadedVideos = [],
  onComplete,
  onCreated,
}: Props) {
  const t = useTranslations("dashboard.edit.create");
  const router = useRouter();
  const searchParams = useSearchParams();

  const preloadedVideoUrl = searchParams.get("videoUrl");

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(preloadedVideoUrl);
  const [videoSec, setVideoSec] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [videoTitle, setVideoTitle] = useState<string>("");

  const [language, setLanguage] = useState("");
  const [template, setTemplate] = useState("");
  const [dictionary, setDictionary] = useState<string[]>([]);
  const [magicZooms, setMagicZooms] = useState(false);
  const [magicBrolls, setMagicBrolls] = useState(false);
  const [magicBrollsPercentage, setMagicBrollsPercentage] = useState(50);
  const [showTemplates, setShowTemplates] = useState(false);
  const [languages, setLanguages] = useState<{ name: string; code: string }[]>(
    []
  );
  const [templates, setTemplates] = useState<string[]>([]);
  const [loadingLang, setLoadingLang] = useState(true);
  const [loadingTpl, setLoadingTpl] = useState(true);

  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const { ensureSubscribed } = useSubscriptionGate();

  /* ---- Dropzone ---- */
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const f = acceptedFiles[0];
      if (!f) return;

      const sizeCheck = validateFileSizeAs(f, "video");
      if (!sizeCheck.ok) {
        toast.error(t("errors.fileTooLarge.title"), {
          description: sizeCheck.message,
        });
        return;
      }

      const url = URL.createObjectURL(f);
      try {
        const sec = await getVideoDurationFromUrl(url);
        if (sec > MAX_SEC) {
          toast.error(
            t("errors.videoDurationExceeded", {
              sec: Math.round(sec),
              max: MAX_SEC,
            })
          );
          URL.revokeObjectURL(url);
          return;
        }
        setFile(f);
        setVideoUrl(url);
        setVideoSec(sec);
        if (!videoTitle.trim()) {
          setVideoTitle(f.name.replace(/\.[^/.]+$/, ""));
        }
        toast.success(t("success.videoLoaded"));
      } catch {
        toast.error(t("errors.analyzeFailed"));
        URL.revokeObjectURL(url);
      }
    },
    [t, videoTitle]
  );

  const validator = (f: File) => {
    const r = validateFileSizeAs(f, "video");
    return r.ok ? null : { code: "file-too-large", message: r.message };
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejs) =>
      rejs.forEach((r) =>
        toast.error(t("errors.fileTooLarge.title"), {
          description: r.errors?.[0]?.message,
        })
      ),
    accept: { "video/*": [] },
    multiple: false,
    disabled: !!videoUrl,
    validator,
  });

  /* ---- Autoselección de vídeo + medir duración ---- */
  useEffect(() => {
    (async () => {
      if (!videoUrl) {
        if (preloadedVideoUrl) {
          setVideoUrl(preloadedVideoUrl);
          const sec = await getVideoDurationFromUrl(preloadedVideoUrl).catch(
            () => 0
          );
          setVideoSec(sec);
          if (sec > MAX_SEC) {
            toast.error(
              t("errors.videoDurationExceeded", {
                sec: Math.round(sec),
                max: MAX_SEC,
              })
            );
          }
        } else if (preloadedVideos.length > 0) {
          const first = preloadedVideos[0];
          setVideoUrl(first.url);
          const sec = await getVideoDurationFromUrl(first.url).catch(() => 0);
          setVideoSec(sec);
          if (!videoTitle.trim() && first.name) setVideoTitle(first.name);
          if (sec > MAX_SEC) {
            toast.error(
              t("errors.videoDurationExceeded", {
                sec: Math.round(sec),
                max: MAX_SEC,
              })
            );
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedVideoUrl, preloadedVideos, t]);

  /* ---- cargar idiomas/templates ---- */
  useEffect(() => {
    fetch("/api/submagic/languages")
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data.languages || []);
      })
      .catch(() => toast.error(t("errors.loadLanguages")))
      .finally(() => setLoadingLang(false));

    fetch("/api/submagic/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.templates || []);
      })
      .catch(() => toast.error(t("errors.loadTemplates")))
      .finally(() => setLoadingTpl(false));
  }, [t]);

  const handleSubmit = async () => {
    flushSync(() => setProcessing(true));
    const ok = await ensureSubscribed({ feature: "submagic" });
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
      toast.error(t("errors.mustSelectVideo"));
      setProcessing(false);
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    const finalTitle =
      videoTitle.trim() ||
      file?.name?.replace(/\.[^/.]+$/, "") ||
      "video-preloaded";

    const tempId = uuidv4();
    const tempVideo = {
      projectId: tempId,
      title: finalTitle,
      status: "processing",
      downloadUrl: videoUrl || undefined,
      _optimistic: true,
    };

    if (typeof onCreated === "function") {
      onCreated(tempVideo as any);
    }

    try {
      let finalVideoUrl = videoUrl;
      if (!finalVideoUrl && file) {
        toast(t("upload.uploading"));
        const { downloadURL } = await uploadVideo(
          file,
          user.uid,
          setUploadProgress
        );
        finalVideoUrl = downloadURL;
      }
      if (!finalVideoUrl) throw new Error(t("errors.noVideoUrl"));

      toast(t("processing.processingVideo"));
      const idToken = await user.getIdToken(true);
      const idem = uuidv4();

      const res = await fetch("/api/submagic/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Idempotency-Key": idem,
        },
        body: JSON.stringify({
          title: finalTitle,
          language,
          videoUrl: finalVideoUrl,
          templateName: template || undefined,
          dictionary: dictionary || undefined,
          magicZooms,
          magicBrolls,
          magicBrollsPercentage,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }

      toast.success(t("success.videoCreated"));

      setFile(null);
      setUploadProgress(0);

      if (typeof onCreated === "function") {
        onCreated();
      } else {
        if (window.location.pathname === "/dashboard/edit") {
          router.refresh();
        } else {
          router.push("/dashboard/edit");
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(t("errors.uploadOrProcessFailed"));

      if (typeof onCreated === "function") {
        onCreated({ ...tempVideo, _rollback: true } as any);
      }
    } finally {
      setSubmitting(false);
      setProcessing(false);
    }
  };

  const isLoading = processing || submitting;
  const buttonText = processing
    ? t("buttons.processing")
    : submitting
    ? t("buttons.generating")
    : onComplete
    ? t("buttons.createVideo")
    : t("buttons.generateEdit");

  /* --------- UI --------- */
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 pb-8">
      {/* Título */}
      <div className="lg:col-span-2 mb-4">
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>

      {/* Layout responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* IZQUIERDA */}
        <div className="flex flex-col gap-4 items-center">
          {preloadedVideos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
              {preloadedVideos.map((v) => (
                <div
                  key={v.id}
                  onClick={async () => {
                    setVideoUrl(v.url);
                    const sec = await getVideoDurationFromUrl(v.url).catch(
                      () => 0
                    );
                    setVideoSec(sec);
                    if (!videoTitle.trim() && v.name) setVideoTitle(v.name);
                    if (sec > MAX_SEC) {
                      toast.error(
                        t("errors.videoDurationExceeded", {
                          sec: Math.round(sec),
                          max: MAX_SEC,
                        })
                      );
                    } else {
                      toast.success(
                        t("selectVideo.selected", { name: v.name })
                      );
                    }
                  }}
                  className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                    videoUrl === v.url ? "ring-2 ring-blue-500" : ""
                  }`}
                >
                  <video
                    src={v.url}
                    className="w-full h-40 object-cover"
                    muted
                    loop
                    playsInline
                  />
                  <div className="p-2 text-sm font-medium truncate">
                    {v.name}
                  </div>
                </div>
              ))}
            </div>
          ) : videoUrl ? (
            <div className="rounded-xl overflow-hidden border w/full max-w-sm aspect-[9/16]">
              <video
                src={videoUrl}
                controls
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center cursor-pointer 
                w-full max-w-[280px] sm:max-w-sm aspect-[9/16] transition
                ${
                  isDragActive
                    ? "border-primary bg-muted"
                    : "border-muted-foreground/50"
                }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <>
                  <VideoIcon className="w-10 h-10 mb-2 text-primary" />
                  <p className="text-sm font-medium text-center">{file.name}</p>
                </>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    {isDragActive
                      ? t("drop.active")
                      : t("drop.prompt")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("drop.hint", { max: MAX_SEC, size: 100 })}
                  </p>
                </>
              )}
            </div>
          )}
          {uploadProgress > 0 && (
            <Progress value={uploadProgress} className="w-full max-w-sm" />
          )}
        </div>

        {/* DERECHA */}
        <div className="space-y-6">
          {/* 🏷️ Campo título */}
          <div>
            <Label className="mb-2 block">{t("fields.title.label")}</Label>
            <Input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder={t("fields.title.placeholder")}
              maxLength={80}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("fields.title.helper")}
            </p>
          </div>

          {/* Templates */}
          <div>
            <Label className="mb-2 block">{t("fields.template.label")}</Label>
            {loadingTpl ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" /> {t("loading.templates")}
              </div>
            ) : (
              <>
                {/* Mobile → botones simples */}
                <div className="sm:hidden">
                  <div className="grid grid-cols-2 gap-2">
                    {(showTemplates ? templates : templates.slice(0, 6)).map((tpl) => (
                      <Button
                        key={tpl}
                        type="button"
                        variant={tpl === template ? "default" : "secondary"}
                        className="w-full"
                        onClick={() => {
                          setTemplate(tpl);
                          toast.success(t("templates.selected", { name: tpl }));
                        }}
                      >
                        {tpl}
                      </Button>
                    ))}
                  </div>
                  {templates.length > 6 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => setShowTemplates(!showTemplates)}
                    >
                      {showTemplates ? t("common.showLess") : t("common.showMore")}
                    </Button>
                  )}
                </div>

                {/* Desktop → selector con preview */}
                <div className="hidden sm:block">
                  <TemplateSelector
                    templates={templates}
                    selected={template}
                    onSelect={setTemplate}
                  />
                </div>
              </>
            )}
          </div>

          {/* Idioma */}
          <div>
            <Label className="mb-2 block">{t("fields.language.label")}</Label>
            {loadingLang ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" /> {t("loading.languages")}
              </div>
            ) : (
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder={t("fields.language.placeholder")} />
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

          {/* Descripción */}
          <div>
            <Label className="mb-2 block">{t("fields.tags.label")}</Label>
            <TagsInput
              value={dictionary}
              onChange={setDictionary}
              placeholder={t("fields.tags.placeholder")}
            />
          </div>

          {/* Opciones mágicas */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox
                      checked={magicZooms}
                      onCheckedChange={(c) => setMagicZooms(!!c)}
                    />
                    <Label>{t("magicZooms.label")}</Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("magicZooms.tooltip")}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox
                      checked={magicBrolls}
                      onCheckedChange={(c) => setMagicBrolls(!!c)}
                    />
                    <Label>{t("magicBrolls.label")}</Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("magicBrolls.tooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {magicBrolls && (
              <div>
                <Label className="mb-1 block">
                  {t("magicBrolls.percentLabel", { percent: magicBrollsPercentage })}
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
          <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
            {buttonText}
          </Button>
        </div>
      </div>

      {/* Modal Paywall */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message={t("paywall.generateAudios")}
      />
    </div>
  );
}
