"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

/* ----------------- Constantes de límites ----------------- */
const MAX_VIDEO_MB = 100;
const MAX_SAMPLE_MB = 10;
const MAX_SAMPLE_SECONDS = 30;
const MAX_TOTAL_SECONDS = 120;

function bytesToMB(bytes: number) {
  return bytes / (1024 * 1024);
}

async function getAudioDurationSafe(url: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("error", onError);
    };

    const onMeta = () => {
      if (isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        cleanup();
        resolve(audio.duration);
      } else {
        audio.currentTime = Number.MAX_SAFE_INTEGER;
      }
    };

    const onTimeUpdate = () => {
      if (isFinite(audio.duration) && !isNaN(audio.duration) && audio.duration > 0) {
        cleanup();
        resolve(audio.duration);
      }
    };

    const onError = () => {
      cleanup();
      reject(new Error("No se pudo leer la duración del audio"));
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("error", onError);
  });
}

/* =========================================================
   Página Onboarding (3 pasos)
========================================================= */

export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showCheckout, setShowCheckout] = useState(false);

  // Paso 1
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [accept, setAccept] = useState(false);

  // Paso 2 – vídeo
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoProgressPct, setVideoProgressPct] = useState(0);
  const [videoDoc, setVideoDoc] = useState<{ id: string; url: string; storagePath: string } | null>(null);

  // Paso 3 – audio
  const [recording, setRecording] = useState(false);
  const [samples, setSamples] = useState<{ name: string; duration: number; url: string; storagePath: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const { ensureSubscribed } = useSubscriptionGate();

   useEffect(() => {
    let initialized = false;

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!initialized) {
        initialized = true;
      }
      setUser(u);
      if (!u) {
        toast.error("Debes iniciar sesión.");
        router.replace("/login");
        return;
      }
      // 👉 Verificar subscripción al entrar
      try {
        const ok = await ensureSubscribed({ feature: "clone"});
        console.log("Subscripción ok:", ok);
        if (!ok) {
          setShowCheckout(true);
        }
      } catch (err) {
        console.error("Error al verificar subscripción:", err);
      }
    });

    return () => unsub();
  }, [router, ensureSubscribed]);



  /* ----------------- Paso 2 ----------------- */
  const handleVideoUpload = async (file: File) => {
    
    if (!user) return;

    if (!file.type.startsWith("video/")) return toast.error("El archivo debe ser un vídeo");
    if (bytesToMB(file.size) > MAX_VIDEO_MB) return toast.error(`El vídeo supera ${MAX_VIDEO_MB} MB`);

    const id = uuidv4();
    const storagePath = `users/${user.uid}/clones/${id}`;
    const storageRef = ref(storage, storagePath);

    setUploadingVideo(true);
    setVideoProgressPct(0);

    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (s) => {
        const pct = Math.round((s.bytesTransferred / s.totalBytes) * 100);
        setVideoProgressPct(pct);
      },
      (err) => {
        console.error(err);
        toast.error("Error subiendo el vídeo");
        setUploadingVideo(false);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("No autenticado");
        const res = await fetch(`/api/firebase/users/${user.uid}/clones/${id}`, {
          method: "PUT", // porque actualizas/creas un documento con ID conocido
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            id,
            url,
            storagePath,
            titulo: file.name.replace(/\.[^/.]+$/, ""),
            createdAt: Date.now(),
            source: "onboarding",
          }),
        });

        if (!res.ok) {
          throw new Error(`Error guardando clonación: ${res.status}`);
        }

        const saved = await res.json();

        // actualizar estado en UI
        setVideoDoc(saved);
        setUploadingVideo(false);
        setVideoProgressPct(0);
        toast.success("Vídeo subido correctamente");

      }
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      const f = files[0];
      if (user && f) handleVideoUpload(f);
    },
    accept: { "video/*": [] },
    multiple: false,
  });

  const removeVideo = async () => {
    if (!user || !videoDoc) return;
    try {
      await deleteObject(ref(storage, videoDoc.storagePath));
      setVideoDoc(null);
      toast("🗑 Vídeo eliminado");
    } catch {
      toast.error("No se pudo eliminar el vídeo");
    }
  };

  /* ----------------- Paso 3 ----------------- */
  const uploadSample = async (file: File) => {

    if (!user) return;

    if (!(file.type.startsWith("audio/") || file.type.startsWith("video/"))) {
      toast.error("Formato no soportado");
      return;
    }
    if (bytesToMB(file.size) > MAX_SAMPLE_MB) {
      toast.error(`Cada muestra ≤ ${MAX_SAMPLE_MB} MB`);
      return;
    }

    // Validar duración
    try {
      const tmpUrl = URL.createObjectURL(file);
      const dur = await getAudioDurationSafe(tmpUrl);
      URL.revokeObjectURL(tmpUrl);
      if (dur > MAX_SAMPLE_SECONDS) {
        toast.error(`Cada muestra ≤ ${MAX_SAMPLE_SECONDS}s`);
        return;
      }
    } catch {
      toast.error("No se pudo calcular duración del audio");
      return;
    }

    const ext = (file.type.split("/")[1] || "webm").replace("x-m4a", "m4a");
    const fileName = `voice-sample-${Date.now()}.${ext}`;
    const storagePath = `users/${user.uid}/voices/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const task = uploadBytesResumable(storageRef, file);
    toast(`📤 Subiendo ${file.name}...`);

    await new Promise<void>((resolve, reject) => {
      task.on(
        "state_changed",
        (s) => {
          const pct = Math.round((s.bytesTransferred / s.totalBytes) * 100);
          setUploadProgress((p) => ({ ...p, [fileName]: pct }));
        },
        (err) => {
          console.error(err);
          toast.error("Error al subir muestra");
          setUploadProgress((p) => {
            const n = { ...p };
            delete n[fileName];
            return n;
          });
          reject(err);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          let duration = 0;
          try {
            duration = await getAudioDurationSafe(url);
          } catch {}
          setSamples((prev) => [...prev, { name: fileName, duration, url, storagePath }]);
          setUploadProgress((p) => {
            const n = { ...p };
            delete n[fileName];
            return n;
          });
          toast.success(`✅ ${file.name} subida`);
          resolve();
        }
      );
    });
  };

  const dropzoneAudio = useDropzone({
    onDrop: async (files) => {
      if (!user) return toast.error("Debes iniciar sesión");
      for (const f of files) {
        await uploadSample(f);
      }
    },
    accept: { "audio/*": [], "video/*": [] },
    multiple: true,
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks.current = [];
    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(audioChunks.current, { type: "audio/webm" });
      if (bytesToMB(blob.size) > MAX_SAMPLE_MB) {
        toast.error(`La grabación supera ${MAX_SAMPLE_MB} MB`);
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      let dur = 0;
      try {
        dur = await getAudioDurationSafe(URL.createObjectURL(blob));
      } catch {
        dur = 0;
      }
      if (dur > MAX_SAMPLE_SECONDS) {
        toast.error(`La grabación supera ${MAX_SAMPLE_SECONDS}s`);
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
      await uploadSample(file);
      stream.getTracks().forEach((t) => t.stop());
    };
    mediaRecorderRef.current.start();
    setRecording(true);
    toast("🎙 Grabando…");
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const removeSample = async (storagePath: string) => {
    try {
      await deleteObject(ref(storage, storagePath));
      setSamples((prev) => prev.filter((s) => s.storagePath !== storagePath));
      toast("🗑 Muestra eliminada");
    } catch {
      toast.error("No se pudo eliminar la muestra");
    }
  };

  const totalDuration = samples.reduce((acc, s) => acc + (isFinite(s.duration) ? s.duration : 0), 0);

  const createVoice = async () => {
    if (!user) return toast.error("Debes iniciar sesión");
    if (samples.length === 0) return toast.error("Sube al menos una muestra de voz");
    if (!videoDoc) return toast.error("Debes subir un vídeo en el paso 2");
    if (!validStep1) return toast.error("Completa los datos del paso 1");
    if (totalDuration === 0) return toast.error("No se pudo calcular duración total");
    if (totalDuration > MAX_TOTAL_SECONDS) {
      return toast.error(`Reduce a ${MAX_TOTAL_SECONDS}s totales o menos`);
    }

    const ok = await ensureSubscribed({ feature: "elevenlabs-voice" });
    console.log(ok)
      if (!ok) {
        setShowCheckout(true); // 👈 abre el modal
        return;
      }


    try {
      const idToken = await user.getIdToken(true);
      const idem = uuidv4();
      const paths = samples.map((s) => s.storagePath);

      toast.loading("Creando voz…");

      // 1. Pedir a ElevenLabs que cree la voz
      const res = await fetch("/api/elevenlabs/voice/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "X-Idempotency-Key": idem,
        },
        body: JSON.stringify({
          paths,
          voiceName: `Voz-${Date.now()}`,
        }),
      });

      const data = await res.json().catch(() => ({} as any));
      toast.dismiss();

      if (!res.ok || !data?.voice_id) {
        return toast.error(
          data?.error || data?.message || "No se pudo crear la voz"
        );
      }

      // 2. Guardar la voz en la subcolección "voices" (API segura)
      const voicePayload = {
        voice_id: data.voice_id,
        name: `Voz-${Date.now()}`,
        paths,
        requires_verification: data.requires_verification ?? false,
        createdAt: Date.now(),
        source: "onboarding",
        idem,
      };

      await fetch(`/api/firebase/users/${user.uid}/voices/${data.voice_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(voicePayload),
      });

      // 3. Actualizar metadata de onboarding en el doc principal del usuario (API segura)
      const userPayload = {
        cloneName: name,
        cloneCategory: category,
        cloneDesc: shortDesc,
        onboardingCompleted: true,
        onboardingCompletedAt: Date.now(),
        firstClone: {
          videoId: videoDoc.id,
          voiceId: data.voice_id,
        },
      };

      await fetch(`/api/firebase/users/${user.uid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(userPayload),
      });

      toast.success("🎉 Onboarding completado. Tu voz está lista.");
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      toast.error("Error de conexión al crear la voz");
    }
  };



  /* ----------------- Validaciones ----------------- */
  const validStep1 = useMemo(() => name.trim().length > 1 && accept, [name, accept]);
  const validStep2 = useMemo(() => !!videoDoc, [videoDoc]);

  const goPrev = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  const goNext = async () => {
    const ok = await ensureSubscribed();
      if (!ok) {
        setShowCheckout(true); // 👈 abre el modal
        return;
      }
    if (step === 1 && !validStep1) return toast.error("Completa el nombre y acepta los términos.");
    if (step === 2 && !validStep2) return toast.error("Sube un vídeo de clonación.");
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Stepper */}
      <Card className="p-4 mb-6 bg-card/60">
        <div className="flex items-center gap-4">
          <StepDot active={step === 1} done={step > 1} label="Datos" idx={1} />
          <Separator className="flex-1" />
          <StepDot active={step === 2} done={step > 2} label="Vídeo" idx={2} />
          <Separator className="flex-1" />
          <StepDot active={step === 3} done={false} label="Audio" idx={3} />
        </div>
      </Card>

      <Card className="p-6 space-y-8">
        {step === 1 && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Tu primer clon</h2>
              <p className="text-sm text-muted-foreground">
                Ponle nombre y una breve descripción. Acepta los términos para continuar.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nombre *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría</label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción breve</label>
                <Textarea rows={4} value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
              </div>
              <div className="flex items-start gap-2 pt-2">
                <Checkbox id="terms" checked={accept} onCheckedChange={(v) => setAccept(Boolean(v))} />
                <label htmlFor="terms" className="text-sm text-muted-foreground">
                  Acepto los{" "}
                  <a className="underline" href="/legal/terminos" target="_blank">términos y condiciones</a>.
                </label>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <h2 className="text-xl font-semibold">Sube tu vídeo de clonación</h2>

            {!videoDoc ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  isDragActive ? "border-primary bg-muted/40" : "border-border"
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="h-6 w-6 mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Haz clic para subir o arrastra y suelta</p>
                <p className="text-xs text-muted-foreground">Solo vídeo • Máx {MAX_VIDEO_MB} MB • Formato 9:16</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <video src={videoDoc.url} controls className="w-full max-h-96 object-cover" />
                <div className="p-3 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Vídeo listo</span>
                  <Button variant="outline" size="sm" onClick={removeVideo}>Reemplazar</Button>
                </div>
              </div>
            )}

            {uploadingVideo && (
              <div className="flex items-center gap-3">
                <Progress value={videoProgressPct} className="w-48" />
                <span className="text-xs">{videoProgressPct}%</span>
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-6">
            <h2 className="text-xl font-semibold">Crea tu voz</h2>
            <p className="text-sm text-muted-foreground">
              Sube muestras o graba directamente • Máx {MAX_TOTAL_SECONDS}s en total • ≤ {MAX_SAMPLE_SECONDS}s por muestra • ≤ {MAX_SAMPLE_MB} MB
            </p>

            <div
              {...dropzoneAudio.getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                dropzoneAudio.isDragActive ? "border-primary bg-muted/40" : "border-border"
              }`}
            >
              <input {...dropzoneAudio.getInputProps()} />
              <UploadCloud className="h-6 w-6 mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Haz clic para subir o arrastra y suelta</p>
              <span className="mt-2 text-xs text-muted-foreground">o</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  recording ? stopRecording() : startRecording();
                }}
                className="mt-3 px-4 py-2 rounded-lg border hover:bg-muted transition"
              >
                {recording ? "⏹ Detener" : "🎙 Grabar audio"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <Progress value={Math.min(100, (totalDuration / MAX_TOTAL_SECONDS) * 100)} className="flex-1" />
              <span className="text-sm font-medium">{Math.round(totalDuration)} / {MAX_TOTAL_SECONDS}s</span>
            </div>

            {samples.length > 0 && (
              <div className="grid gap-3">
                {samples.map((s) => (
                  <div key={s.storagePath} className="flex items-center gap-3 rounded-lg border p-3">
                    <audio controls src={s.url} className="h-8" />
                    <span className="text-xs text-muted-foreground">
                      {s.name} — {Math.round(s.duration)}s
                    </span>
                    <Button variant="ghost" size="icon" className="ml-auto" onClick={() => removeSample(s.storagePath)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={createVoice}
                disabled={
                  samples.length === 0 ||
                  totalDuration === 0 ||
                  totalDuration > MAX_TOTAL_SECONDS ||
                  !videoDoc ||
                  !validStep1
                }
              >
                Crear voz y finalizar
              </Button>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={goPrev} disabled={step === 1}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Atrás
          </Button>
          {step < 3 ? (
            <Button onClick={goNext}>
              Siguiente <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <div></div>
          )}
        </div>
      </Card>
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS" // 👈 aquí eliges el plan por defecto
        message="Para clonar tu voz necesitas activar una suscripción."
      />

    </div>
  );
}

/* ---------- Stepper Dot ---------- */
function StepDot({
  active,
  done,
  idx,
  label,
}: { active: boolean; done: boolean; idx: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          "h-8 w-8 rounded-full flex items-center justify-center border",
          done
            ? "bg-primary text-primary-foreground border-primary"
            : active
            ? "bg-foreground text-background border-foreground"
            : "bg-muted text-muted-foreground border-border",
        ].join(" ")}
      >
        {done ? <Check className="h-4 w-4" /> : idx}
      </div>
      <span className={["text-sm", active ? "font-semibold" : "text-muted-foreground"].join(" ")}>
        {label}
      </span>
    </div>
  );
}
