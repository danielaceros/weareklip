// src/components/edit/CreateVideoPage.tsx  (ajusta la ruta si es otra)
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import { uploadVideo } from "@/lib/uploadVideo";

import { VideoDropzone } from "./VideoDropzone";
import { LanguageSelect } from "./LanguageSelect";
import { TemplateSelect } from "./TemplateSelect";
import { DictionaryInput } from "./DictionaryInput";
import { MagicOptions } from "./MagicOptions";

// 👇 importamos el hook del paywall
import useSubscriptionGate from "@/hooks/useSubscriptionGate";

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
  const [dictionary, setDictionary] = useState("");
  const [magicZooms, setMagicZooms] = useState(false);
  const [magicBrolls, setMagicBrolls] = useState(false);
  const [magicBrollsPercentage, setMagicBrollsPercentage] = useState(50);

  const [submitting, setSubmitting] = useState(false);

  // 👇 gate de suscripción
  const { ensureSubscribed } = useSubscriptionGate();

  const handleSubmit = async () => {
    // 1) Bloqueo por suscripción ANTES de subir nada
    const ok = await ensureSubscribed({ feature: "submagic" }); // etiqueta libre para analytics
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
      let finalVideoUrl = videoUrl;

      // si no hay URL, subimos el archivo a Firebase
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

      // enviamos a API para crear en Submagic
      const res = await fetch("/api/submagic/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file?.name || "video-preloaded",
          language,
          videoUrl: finalVideoUrl,
          templateName: template || undefined,
          dictionary: dictionary
            ? dictionary.split(",").map((w) => w.trim())
            : undefined,
          magicZooms,
          magicBrolls,
          magicBrollsPercentage,
          uid: user.uid,
          email: user.email,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("✅ Vídeo creado correctamente");
        setFile(null);
        setUploadProgress(0);
        router.push("/dashboard/edit");
      } else {
        toast.error(data.error || "Error desconocido al crear el vídeo");
      }
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
