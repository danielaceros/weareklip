// src/components/edit/CreateVideoPage.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { uploadVideo } from "@/lib/uploadVideo";
import { v4 as uuidv4 } from "uuid";

// UI locales
import { VideoDropzone } from "./VideoDropzone";
import { LanguageSelect } from "./LanguageSelect";
import { TemplateSelect } from "./TemplateSelect";
import { DictionaryInput } from "./DictionaryInput";
import { MagicOptions } from "./MagicOptions";

// Paywall
import useSubscriptionGate from "@/hooks/useSubscriptionGate";

/* ---------- utilidades de parsing (sin any) ---------- */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function hasString(v: unknown, key: string): v is Record<string, string> {
  return isRecord(v) && typeof v[key] === "string";
}
/* ----------------------------------------------------- */

export default function CreateVideoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preloadedVideoUrl = searchParams.get("videoUrl");

  // estado de archivo y video
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(preloadedVideoUrl);
  const [uploadProgress, setUploadProgress] = useState(0);

  // parámetros de edición
  const [language, setLanguage] = useState("");
  const [template, setTemplate] = useState("");
  const [dictionary, setDictionary] = useState(""); // texto; el backend ya lo normaliza
  const [magicZooms, setMagicZooms] = useState(false);
  const [magicBrolls, setMagicBrolls] = useState(false);
  const [magicBrollsPercentage, setMagicBrollsPercentage] = useState(50);

  const [submitting, setSubmitting] = useState(false);

  // gate de suscripción
  const { ensureSubscribed } = useSubscriptionGate();

  const handleSubmit = async () => {
    // 1) Bloqueo por suscripción ANTES de subir nada
    const ok = await ensureSubscribed({ feature: "submagic" });
    if (!ok) return;

    const user = auth.currentUser;
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }
    if (!videoUrl && !file) {
      toast.error("Debes subir un vídeo o usar uno precargado");
      return;
    }
    if (!language) {
      toast.error("Debes seleccionar un idioma");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      // 2) Subir si no hay URL previa
      let finalVideoUrl = videoUrl;
      if (!finalVideoUrl && file) {
        const { downloadURL } = await uploadVideo(
          file,
          user.uid,
          setUploadProgress
        );
        finalVideoUrl = downloadURL;
      }
      if (!finalVideoUrl)
        throw new Error("No se pudo obtener la URL del vídeo");

      // 3) Enviar a la API propia que llama a Submagic (con auth + idempotencia)
      const idToken = await user.getIdToken(true);
      const idem = uuidv4();

      const res = await fetch("/api/submagic/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Idempotency-Key": idem, // recomendado
        },
        body: JSON.stringify({
          title: file?.name || "video-preloaded",
          language,
          videoUrl: finalVideoUrl,
          templateName: template || undefined,
          dictionary: dictionary || undefined, // lo normaliza el backend
          magicZooms,
          magicBrolls,
          magicBrollsPercentage,
        }),
      });

      // 4) Parse robusto (JSON o texto)
      const raw = await res.text();
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { message: raw };
      }

      // 5) Errores de API
      if (!res.ok) {
        const msg =
          (hasString(parsed, "error") && parsed.error) ||
          (hasString(parsed, "message") && parsed.message) ||
          `HTTP ${res.status}`;
        toast.error(msg);
        return;
      }

      // 6) Éxito (usa el id del proyecto si viene)
      const projectId = hasString(parsed, "id") ? parsed.id : undefined;
      toast.success(
        `✅ Vídeo creado correctamente${projectId ? ` (ID: ${projectId})` : ""}`
      );

      // Limpieza + navegación
      setFile(null);
      setUploadProgress(0);
      router.push("/dashboard/edit");
    } catch (error) {
      console.error(error);
      toast.error("Error subiendo o procesando el vídeo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Upload / previsualización */}
      <VideoDropzone
        file={file}
        setFile={setFile}
        videoUrl={videoUrl}
        setVideoUrl={setVideoUrl}
      />

      {/* progreso de subida */}
      {uploadProgress > 0 && <Progress value={uploadProgress} />}

      {/* selects y opciones */}
      <LanguageSelect value={language} onChange={setLanguage} />
      <TemplateSelect value={template} onChange={setTemplate} />
      <DictionaryInput value={dictionary} onChange={setDictionary} />
      <MagicOptions
        magicZooms={magicZooms}
        setMagicZooms={setMagicZooms}
        magicBrolls={magicBrolls}
        setMagicBrolls={setMagicBrolls}
        magicBrollsPercentage={magicBrollsPercentage}
        setMagicBrollsPercentage={setMagicBrollsPercentage}
      />

      {/* botón final */}
      <Button onClick={handleSubmit} disabled={submitting} className="w-full">
        {submitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        Crear vídeo
      </Button>
    </div>
  );
}
