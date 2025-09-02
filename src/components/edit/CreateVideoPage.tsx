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
import { TagsInput } from "../shared/TagsInput";

/* ---------- utilidades ---------- */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function hasString(v: unknown, key: string): v is Record<string, string> {
  return isRecord(v) && typeof v[key] === "string";
}
/* -------------------------------- */

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
  onCreated?: () => void; // 👈 añadida
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
  const [uploadProgress, setUploadProgress] = useState(0);

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
  const [processing, setProcessing] = useState(false); // inmediato
  const [submitting, setSubmitting] = useState(false); // API real
  const [showCheckout, setShowCheckout] = useState(false);

  const { ensureSubscribed } = useSubscriptionGate();

  /* ---- Dropzone ---- */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setVideoUrl(null);
      toast.success(`📹 Vídeo "${acceptedFiles[0].name}" cargado`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    disabled: !!videoUrl,
  });

  /* ---- Autoselección de vídeo ---- */
  useEffect(() => {
    // Si aún no hay selección ni archivo y tenemos vídeos pre-cargados,
    // seleccionamos automáticamente el primero (asumimos ordenado por más reciente)
    if (!videoUrl && !file) {
      if (preloadedVideoUrl) {
        setVideoUrl(preloadedVideoUrl);
      } else if (preloadedVideos.length > 0) {
        setVideoUrl(preloadedVideos[0].url);
      }
    }
  }, [preloadedVideoUrl, preloadedVideos, videoUrl, file]);

  /* ---- cargar idiomas/templates ---- */
  useEffect(() => {
    fetch("/api/submagic/languages")
      .then((res) => res.json())
      .then((data) => {
        setLanguages(data.languages || []);
        toast.success("🌍 Idiomas cargados");
      })
      .catch(() => toast.error("❌ Error cargando idiomas"))
      .finally(() => setLoadingLang(false));

    fetch("/api/submagic/templates")
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.templates || []);
        toast.success("📑 Templates cargados");
      })
      .catch(() => toast.error("❌ Error cargando templates"))
      .finally(() => setLoadingTpl(false));
  }, []);

  const handleSubmit = async () => {
    flushSync(() => setProcessing(true)); // feedback inmediato
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
    if (!language) {
      toast.error("⚠️ Debes seleccionar un idioma");
      setProcessing(false);
      return;
    }

    // Si viene desde wizard → devolvemos datos en vez de llamar API
    if (onComplete) {
      const selectedVideo = videoUrl || preloadedVideos[0]?.url || "";
      toast.success("✅ Selección guardada correctamente");
      onComplete({
        selectedVideo,
        subLang: language,
        template,
        dictionary,
        magicZooms,
        magicBrolls,
        magicBrollsPercentage,
      });
      setProcessing(false);
      return;
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
          title: file?.name || "video-preloaded",
          language,
          videoUrl: finalVideoUrl,
          templateName: template || undefined,
          dictionary: dictionary || undefined,
          magicZooms,
          magicBrolls,
          magicBrollsPercentage,
        }),
      });

      const raw = await res.text();
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { message: raw };
      }

      if (!res.ok) {
        const msg =
          (hasString(parsed, "error") && parsed.error) ||
          (hasString(parsed, "message") && parsed.message) ||
          `HTTP ${res.status}`;
        toast.error(msg);
        return;
      }

      const projectId = hasString(parsed, "id") ? parsed.id : undefined;
      toast.success(
        `🎬 Vídeo creado correctamente${projectId ? ` (ID: ${projectId})` : ""}`
      );

      setFile(null);
      setUploadProgress(0);

      // ✅ cerrar modal padre y refrescar lista
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
      toast.error("❌ Error subiendo o procesando el vídeo");
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

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
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
                  onClick={() => {
                    setVideoUrl(v.url);
                    toast.success(`🎥 Vídeo "${v.name}" seleccionado`);
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
            <div className="rounded-xl overflow-hidden border w-full max-w-sm aspect-[9/16]">
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
                w-full max-w-[280px] sm:max-w-sm aspect-[9/16] max-h-[10vh] transition
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
                {/* Mobile: 3 filas + toggle */}
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

                {/* Desktop: todos */}
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
            <Label className="mb-2 block">Describe en 3-4 palabras el vídeo</Label>
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
                      onCheckedChange={(c) => {
                        setMagicZooms(!!c);
                        toast(
                          !!c
                            ? "🔍 Magic Zooms activado"
                            : "Magic Zooms desactivado"
                        );
                      }}
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
                      onCheckedChange={(c) => {
                        setMagicBrolls(!!c);
                        toast(
                          !!c
                            ? "🎞 Magic B-rolls activado"
                            : "Magic B-rolls desactivado"
                        );
                      }}
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
                  onValueChange={(v) => {
                    setMagicBrollsPercentage(v[0]);
                    toast(`🎬 Porcentaje de B-rolls: ${v[0]}%`);
                  }}
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