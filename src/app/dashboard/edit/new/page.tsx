"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Loader2, UploadCloud, VideoIcon } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";
import { auth } from "@/lib/firebase";
import { uploadVideo } from "@/lib/uploadVideo";

type LanguageOption = { name: string; code: string };

export default function SubmagicUploader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preloadedVideoUrl = searchParams.get("videoUrl");

  const [templates, setTemplates] = useState<string[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingLanguages, setLoadingLanguages] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(preloadedVideoUrl);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [template, setTemplate] = useState("");
  const [language, setLanguage] = useState("");
  const [dictionary, setDictionary] = useState("");
  const [magicZooms, setMagicZooms] = useState(false);
  const [magicBrolls, setMagicBrolls] = useState(false);
  const [magicBrollsPercentage, setMagicBrollsPercentage] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/submagic/templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .finally(() => setLoadingTemplates(false));

    fetch("/api/submagic/languages")
      .then((res) => res.json())
      .then((data) => setLanguages(data.languages || []))
      .finally(() => setLoadingLanguages(false));
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      setVideoUrl(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
    multiple: false,
    disabled: !!videoUrl,
  });

  const handleSubmit = async () => {
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

      if (!finalVideoUrl && file) {
        const { downloadURL } = await uploadVideo(file, user.uid, setUploadProgress);
        finalVideoUrl = downloadURL;
      }
      if (!finalVideoUrl) throw new Error("No se pudo obtener la URL del vídeo");

      const res = await fetch("/api/submagic/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file?.name || "video-preloaded",
          language,
          videoUrl: finalVideoUrl,
          templateName: template || undefined,
          dictionary: dictionary ? dictionary.split(",").map((w) => w.trim()) : undefined,
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
      {videoUrl ? (
        <div className="rounded-xl overflow-hidden border w-full aspect-[9/16]">
          <video src={videoUrl} controls className="w-full h-full object-cover" />
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer w-full aspect-[9/16] transition ${
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

      {uploadProgress > 0 && <Progress value={uploadProgress} />}

      {/* Idioma */}
      <div>
        <Label>Idioma</Label>
        {loadingLanguages ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin h-4 w-4" /> Cargando idiomas...
          </div>
        ) : (
          <Select onValueChange={setLanguage}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un idioma" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Template */}
      <div>
        <Label>Template</Label>
        {loadingTemplates ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="animate-spin h-4 w-4" /> Cargando templates...
          </div>
        ) : (
          <Select onValueChange={setTemplate}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Diccionario */}
      <div>
        <Label>Diccionario (palabras separadas por comas)</Label>
        <Input
          value={dictionary}
          onChange={(e) => setDictionary(e.target.value)}
          placeholder="Ej: Submagic, IA, captions"
        />
      </div>

      {/* Opciones */}
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox checked={magicZooms} onCheckedChange={(c) => setMagicZooms(!!c)} />
          <Label>Magic Zooms</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox checked={magicBrolls} onCheckedChange={(c) => setMagicBrolls(!!c)} />
          <Label>Magic B-rolls</Label>
        </div>
      </div>

      {magicBrolls && (
        <div>
          <Label>Porcentaje de B-rolls: {magicBrollsPercentage}%</Label>
          <Slider
            defaultValue={[magicBrollsPercentage]}
            max={100}
            step={1}
            onValueChange={(v) => setMagicBrollsPercentage(v[0])}
          />
        </div>
      )}

      {/* Botón */}
      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full"
      >
        {submitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
        Crear vídeo
      </Button>
    </div>
  );
}
