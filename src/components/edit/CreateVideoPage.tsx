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
import { Input } from "@/components/ui/input"; // ⬅️ nuevo

/* ✅ límite de tamaño (100 MB vídeo) */
import { validateFileSizeAs } from "@/lib/fileLimits";
import { VideoData } from "./VideosPage";

const MAX_SEC = 60; // ⏱️ límite duro

const getVideoDurationFromUrl = (url: string) =>
  new Promise<number>((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = url;
    v.onloadedmetadata = () => resolve(v.duration || 0);
    v.onerror = () =>
      reject(new Error("No se pudo leer la duración del vídeo"));
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Si viene un vídeo por query (?videoUrl=...) lo respetamos
  const preloadedVideoUrl = searchParams.get("videoUrl");

  // estado de archivo y video
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(preloadedVideoUrl);
  const [videoSec, setVideoSec] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 🏷️ título del vídeo (opcional)
  const [videoTitle, setVideoTitle] = useState<string>(""); // ⬅️ nuevo

  // parámetros de edición
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

  // estados del botón
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const { ensureSubscribed } = useSubscriptionGate();

  /* ---- Dropzone ---- */
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const f = acceptedFiles[0];
      if (!f) return;

      // ⛔️ 1) Tamaño (100 MB vídeo)
      const sizeCheck = validateFileSizeAs(f, "video");
      if (!sizeCheck.ok) {
        toast.error("Archivo demasiado grande", {
          description: sizeCheck.message,
        });
        return;
      }

      // ⏱️ 2) Duración (60 s)
      const url = URL.createObjectURL(f);
      try {
        const sec = await getVideoDurationFromUrl(url);
        if (sec > MAX_SEC) {
          toast.error(
            `⏱️ El vídeo dura ${Math.round(sec)}s y el máximo es ${MAX_SEC}s.`
          );
          URL.revokeObjectURL(url);
          return;
        }
        setFile(f);
        setVideoUrl(url);
        setVideoSec(sec);
        // si no hay título aún, proponemos el nombre del archivo (sin extender)
        if (!videoTitle.trim()) {
          setVideoTitle(f.name.replace(/\.[^/.]+$/, "")); // sin extensión
        }
        toast.success("📹 Vídeo cargado");
      } catch {
        toast.error("No se pudo analizar el vídeo.");
        URL.revokeObjectURL(url);
      }
    },
    [videoTitle]
  );

  // ✅ Validator del drop (rechaza antes de onDrop)
  const validator = (f: File) => {
    const r = validateFileSizeAs(f, "video"); // 100 MB
    return r.ok ? null : { code: "file-too-large", message: r.message };
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejs) =>
      rejs.forEach((r) =>
        toast.error("Archivo demasiado grande", {
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
              `⏱️ El vídeo dura ${Math.round(sec)}s y el máximo es ${MAX_SEC}s.`
            );
          }
        } else if (preloadedVideos.length > 0) {
          const first = preloadedVideos[0];
          setVideoUrl(first.url);
          const sec = await getVideoDurationFromUrl(first.url).catch(() => 0);
          setVideoSec(sec);
          if (!videoTitle.trim() && first.name) setVideoTitle(first.name); // ⬅️ sugerir
          if (sec > MAX_SEC) {
            toast.error(
              `⏱️ El vídeo dura ${Math.round(sec)}s y el máximo es ${MAX_SEC}s.`
            );
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedVideoUrl, preloadedVideos]);

  /* ---- cargar idiomas/templates (sin cambios) ---- */
  useEffect(() => {
    fetch("/api/submagic/languages")
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data.languages || []);
      })
      .catch(() => toast.error("❌ Error cargando idiomas"))
      .finally(() => setLoadingLang(false));

    fetch("/api/submagic/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.templates || []);
      })
      .catch(() => toast.error("❌ Error cargando templates"))
      .finally(() => setLoadingTpl(false));
  }, []);

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
      toast.error("⚠️ Debes iniciar sesión");
      setProcessing(false);
      return;
    }

    if (!videoUrl && !file && preloadedVideos.length === 0) {
      toast.error("⚠️ Debes subir o seleccionar un vídeo");
      setProcessing(false);
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    // 🏷️ título final (respeta lo que haya escrito el usuario)
    const finalTitle =
      videoTitle.trim() ||
      file?.name?.replace(/\.[^/.]+$/, "") ||
      "video-preloaded";

    // 🔹 Optimistic
    const tempId = uuidv4();
    const tempVideo = {
      projectId: tempId,
      title: finalTitle, // ⬅️ usamos tu título
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
        toast("☁️ Subiendo vídeo a la nube...");
        const { downloadURL } = await uploadVideo(
          file,
          user.uid,
          setUploadProgress
        );
        finalVideoUrl = downloadURL;
      }
      if (!finalVideoUrl)
        throw new Error("No se pudo obtener la URL del vídeo");

      toast("⚙️ Procesando tu vídeo...");
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
          title: finalTitle, // ⬅️ lo mandamos al backend
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

      toast.success("🎬 Vídeo creado correctamente");

      setFile(null);
      setUploadProgress(0);

      if (typeof onCreated === "function") {
        onCreated(); // el padre puede refetchear
      } else {
        if (window.location.pathname === "/dashboard/edit") {
          router.refresh();
        } else {
          router.push("/dashboard/edit");
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("❌ Error subiendo o procesando el vídeo");

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
    ? "Procesando..."
    : submitting
    ? "Generando..."
    : onComplete
    ? "Crear vídeo"
    : "Generar edición de vídeo";

  /* --------- UI --------- */
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 pb-8">
      {/* Título */}
      <div className="lg:col-span-2 mb-4">
        <h2 className="text-2xl font-bold">🎥 Edición de Vídeo IA</h2>
        <p className="text-muted-foreground text-sm">
          Sube o selecciona un vídeo y aplica plantillas automáticas con IA.
        </p>
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
                    if (!videoTitle.trim() && v.name) setVideoTitle(v.name); // ⬅️ sugerir nombre
                    if (sec > MAX_SEC) {
                      toast.error(
                        `⏱️ El vídeo dura ${Math.round(
                          sec
                        )}s y el máximo es ${MAX_SEC}s.`
                      );
                    } else {
                      toast.success(`🎥 Vídeo "${v.name}" seleccionado`);
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
                      ? "Suelta el vídeo aquí..."
                      : "Arrastra un vídeo o haz click"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hasta 60s y 100&nbsp;MB
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
            <Label className="mb-2 block">Título (opcional)</Label>
            <Input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="Ej: Lanzamiento producto – vertical"
              maxLength={80}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Si lo dejas vacío, usaremos el nombre del archivo o
              “video-preloaded”.
            </p>
          </div>

          {/* Templates */}
          <div>
            <Label className="mb-2 block">Template</Label>
            {loadingTpl ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" /> Cargando
                templates...
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="sm:hidden">
                  <div className="grid grid-cols-2 gap-2">
                    {(showTemplates ? templates : templates.slice(0, 6)).map(
                      (t) => (
                        <Button
                          key={t}
                          type="button"
                          variant={t === template ? "default" : "secondary"}
                          className="w-full"
                          onClick={() => {
                            setTemplate(t);
                            toast.success(`📑 Template "${t}" seleccionado`);
                          }}
                        >
                          {t}
                        </Button>
                      )
                    )}
                  </div>
                  {templates.length > 6 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => setShowTemplates(!showTemplates)}
                    >
                      {showTemplates ? "Ver menos" : "Ver más"}
                    </Button>
                  )}
                </div>

                {/* Desktop */}
                <div className="hidden sm:grid sm:grid-cols-3 gap-3">
                  {templates.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant={t === template ? "default" : "secondary"}
                      className="w-full"
                      onClick={() => {
                        setTemplate(t);
                        toast.success(`📑 Template "${t}" seleccionado`);
                      }}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Idioma */}
          <div>
            <Label className="mb-2 block">Idioma</Label>
            {loadingLang ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin h-4 w-4" /> Cargando idiomas...
              </div>
            ) : (
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
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

          {/* Descripción */}
          <div>
            <Label className="mb-2 block">
              Describe en 3-4 palabras el vídeo
            </Label>
            <TagsInput
              value={dictionary}
              onChange={setDictionary}
              placeholder="Escribe un tag y pulsa Enter o coma..."
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
                    <Label>Magic Zooms</Label>
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
                      onCheckedChange={(c) => setMagicBrolls(!!c)}
                    />
                    <Label>Magic B-rolls</Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Inserta B-rolls automáticos relevantes en tu vídeo.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {magicBrolls && (
              <div>
                <Label className="mb-1 block">
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
            className="w-full"
          >
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
        message="Necesitas una suscripción activa para generar audios."
      />
    </div>
  );
}
