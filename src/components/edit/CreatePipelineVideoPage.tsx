"use client";

import { useState, useCallback, useEffect } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
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
  TooltipProvider,
} from "@/components/ui/tooltip";

// 👇 Importar el helper de Analytics
import { track } from "@/lib/analytics-events";

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
  audioUrl: string; // 👈 obligatorio para el pipeline
  onComplete?: () => void; // callback opcional
}

export default function CreatePipelineVideoPage({
  preloadedVideos = [],
  audioUrl,
  onComplete,
}: Props) {
  const router = useRouter();

  // estado de archivo y video
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // parámetros de edición
  const [language, setLanguage] = useState("");
  const [template, setTemplate] = useState("");
  const [dictionary, setDictionary] = useState("");
  const [magicZooms, setMagicZooms] = useState(false);
  const [magicBrolls, setMagicBrolls] = useState(false);
  const [magicBrollsPercentage, setMagicBrollsPercentage] = useState(50);

  const [languages, setLanguages] = useState<{ name: string; code: string }[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [loadingLang, setLoadingLang] = useState(true);
  const [loadingTpl, setLoadingTpl] = useState(true);

  // estados del botón
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { ensureSubscribed } = useSubscriptionGate();

  /* ---- Dropzone ---- */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setVideoUrl(null);
      toast.success(`📹 Vídeo "${acceptedFiles[0].name}" cargado`);
      track("video_uploaded", { fileName: acceptedFiles[0].name });
    }
  }, []);
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

    setSubmitting(true);
    setUploadProgress(0);

    try {
      let finalVideoUrl = videoUrl;
      if (!finalVideoUrl && file) {
        toast("☁️ Subiendo vídeo a la nube...");
        const { downloadURL } = await uploadVideo(file, user.uid, setUploadProgress);
        finalVideoUrl = downloadURL;
        track("video_uploaded_cloud", { url: downloadURL });
      }
      if (!finalVideoUrl) throw new Error("No se pudo obtener la URL del vídeo");

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
        track("pipeline_failed", { error: msg });
        return;
      }

      toast.success("🎬 Reel enviado al pipeline correctamente");

      // 📊 Evento GA: reel enviado
      track("pipeline_reel_submitted", {
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
    <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
      {/* Título */}
      <div className="lg:col-span-2 mb-4">
        <h2 className="text-2xl font-bold">🎬 Crear Reel con Pipeline</h2>
        <p className="text-muted-foreground text-sm">
          Sube o selecciona un vídeo y combínalo con tu audio para enviarlo al pipeline.
        </p>
      </div>

      {/* IZQUIERDA */}
      <div className="flex flex-col gap-4 items-center">
        {preloadedVideos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 w-full">
            {preloadedVideos.map((v) => (
              <div
                key={v.id}
                onClick={() => {
                  setVideoUrl(v.url);
                  toast.success(`🎥 Vídeo "${v.name}" seleccionado`);
                  track("video_selected", { name: v.name });
                }}
                className={`border rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                  videoUrl === v.url ? "ring-2 ring-blue-500" : ""
                }`}
              >
                <video src={v.url} className="w-full h-40 object-cover" muted loop playsInline />
                <div className="p-2 text-sm font-medium truncate">{v.name}</div>
              </div>
            ))}
          </div>
        ) : videoUrl ? (
          <div className="rounded-xl overflow-hidden border w-full max-w-sm aspect-[9/16]">
            <video src={videoUrl} controls className="w-full h-full object-cover" />
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer w-full max-w-sm aspect-[9/16] transition ${
              isDragActive ? "border-primary bg-muted" : "border-muted-foreground/50"
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
                  {isDragActive ? "Suelta el vídeo aquí..." : "Arrastra un vídeo o haz click"}
                </p>
              </>
            )}
          </div>
        )}
        {uploadProgress > 0 && <Progress value={uploadProgress} className="w-full max-w-sm" />}
      </div>

      {/* DERECHA: opciones */}
      <div className="space-y-6">
        {/* Templates */}
        <div>
          <Label className="mb-2 block">Template</Label>
          {loadingTpl ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin h-4 w-4" /> Cargando templates...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {templates.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={t === template ? "default" : "secondary"}
                  className="w-full"
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
          <Label className="mb-2 block">Idioma</Label>
          {loadingLang ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin h-4 w-4" /> Cargando idiomas...
            </div>
          ) : (
            <Select
              value={language}
              onValueChange={(val) => {
                setLanguage(val);
                track("language_selected", { language: val });
              }}
            >
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

        {/* Diccionario */}
        <div>
          <Label className="mb-2 block">Descripción breve</Label>
          <Input
            value={dictionary}
            onChange={(e) => {
              setDictionary(e.target.value);
              track("dictionary_updated");
            }}
            placeholder="Escribe una breve descripción..."
          />
        </div>

        {/* Opciones mágicas con tooltips */}
        <div className="space-y-4">
        <div className="flex items-center gap-6">
            <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                    checked={magicZooms}
                    onCheckedChange={(c) => {
                    setMagicZooms(!!c);
                    track("magic_zooms_toggled", { enabled: !!c });
                    toast(!!c ? "🔍 Magic Zooms activado" : "Magic Zooms desactivado");
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
                    track("magic_brolls_toggled", { enabled: !!c });
                    toast(!!c ? "🎞 Magic B-rolls activado" : "Magic B-rolls desactivado");
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
                track("magic_brolls_percentage", { value: v[0] });
                toast(`🎬 Porcentaje de B-rolls: ${v[0]}%`);
                }}
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
  );
}
