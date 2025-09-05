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
const MAX_VIDEO_MB = 1000;
const MAX_SAMPLE_MB = 100;
const MAX_SAMPLE_SECONDS = 300;
const MAX_TOTAL_SECONDS = 300;

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
  const [subscribed, setSubscribed] = useState(false);

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

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptAup, setAcceptAup] = useState(false);
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
        const ok = await ensureSubscribed({ feature: "clone" });
        setSubscribed(ok); // 👈 guardamos el estado
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

    // 👉 Optimistic UI: mostrar un objeto provisional en la UI
    const tempUrl = URL.createObjectURL(file);
    setVideoDoc({ id, url: tempUrl, storagePath });
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
        setVideoDoc(null); // revertir si falla
        setUploadingVideo(false);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("No autenticado");

        await fetch(`/api/firebase/users/${user.uid}/clones/${id}`, {
          method: "PUT",
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

        // 👉 Reemplazar el objeto temporal con el definitivo
        setVideoDoc({ id, url, storagePath });
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

    const ext = (file.type.split("/")[1] || "webm").replace("x-m4a", "m4a");
    const fileName = `sample-${Date.now()}.${ext}`;
    const storagePath = `users/${user.uid}/voices/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // 👉 Optimistic UI: mostrar inmediatamente la muestra
    const tempUrl = URL.createObjectURL(file);
    setSamples((prev) => [...prev, { name: fileName, duration: 0, url: tempUrl, storagePath }]);
    setUploadProgress((p) => ({ ...p, [fileName]: 0 }));

    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (s) => {
        const pct = Math.round((s.bytesTransferred / s.totalBytes) * 100);
        setUploadProgress((p) => ({ ...p, [fileName]: pct }));
      },
      (err) => {
        console.error(err);
        toast.error("Error al subir muestra");
        setSamples((prev) => prev.filter((s) => s.storagePath !== storagePath)); // revertir
        setUploadProgress((p) => {
          const n = { ...p };
          delete n[fileName];
          return n;
        });
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        let duration = 0;
        try {
          duration = await getAudioDurationSafe(url);
        } catch {}

        // 👉 Reemplazar muestra provisional por la real
        setSamples((prev) =>
          prev.map((s) =>
            s.storagePath === storagePath ? { ...s, url, duration } : s
          )
        );
        setUploadProgress((p) => {
          const n = { ...p };
          delete n[fileName];
          return n;
        });
        toast.success(`✅ ${file.name} subida`);
      }
    );
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

      toast.loading("Clonando...");

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
  const validStep1 = useMemo(() => acceptTerms && acceptAup, [acceptTerms, acceptAup]);
  const validStep2 = useMemo(() => !!videoDoc, [videoDoc]);

  const goPrev = () => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  const goNext = async () => {
    // ✅ Primero: validaciones sincronas
    if (step === 1 && !validStep1) {
      return toast.error("Debes aceptar los Términos y la Política de Uso Aceptable.");
    }
    if (step === 2 && !validStep2) {
      return toast.error("Sube un vídeo de clonación.");
    }

    // ✅ Optimistic UI: avanzar inmediatamente
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));

    // 🔄 En background (no bloquea la UI)
    (async () => {
      try {
        const ok = await ensureSubscribed();
        if (!ok) {
          setShowCheckout(true);
          return;
        }

        // Guardar flag en paso 1
        if (step === 1 && user && acceptTerms && acceptAup) {
          try {
            const idToken = await user.getIdToken(true);
            await fetch(`/api/firebase/users/${user.uid}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ isTermsAccepted: true }),
            });
            console.log("✅ Flag isTermsAccepted actualizado en Firestore");
          } catch (err) {
            console.error("Error al actualizar isTermsAccepted:", err);
          }
        }
      } catch (err) {
        console.error("Error al verificar subscripción:", err);
        toast.error("No se pudo verificar tu suscripción.");
      }
    })();
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
          <section className="space-y-6">
            <h2 className="text-xl font-semibold">Términos y uso responsable</h2>
            <p className="text-sm text-muted-foreground">
              Lee y acepta los documentos antes de continuar con tu onboarding.
            </p>

            {/* 📜 Preview deslizable */}
            <Card className="border rounded-md">
              <div className="h-64 overflow-y-auto p-4 text-sm leading-relaxed space-y-6 bg-muted/40">
                {/* --- Extracto de Términos --- */}
                <div>
                  <h3 className="font-medium mb-2">Términos y Condiciones</h3>
                  <p>
                    El acceso y uso de la Plataforma implica la aceptación íntegra de los
                    Términos y Condiciones. KLIP podrá modificarlos en cualquier momento; el
                    uso continuado supone la aceptación de los Términos vigentes.
                  </p>
                  <p>
                    KLIP es una plataforma SaaS que automatiza la creación de contenidos
                    audiovisuales mediante IA (guiones, voces sintéticas, lip-sync, subtitulado).
                    El servicio se presta “tal cual” y “según disponibilidad”.
                  </p>
                  <p>
                    El Usuario ostenta los derechos sobre los contenidos generados, salvo
                    licencias de terceros. KLIP no usará tus outputs con fines promocionales sin
                    consentimiento expreso...
                  </p>
                </div>

                {/* --- Extracto de AUP --- */}
                <div>
                  <h3 className="font-medium mb-2">Política de Uso Aceptable (AUP)</h3>
                  <p>
                    Esta AUP define las reglas de uso de la Plataforma KLIP. Se prohíben
                    contenidos ilegales o dañinos (CSAM, incitación al odio, violencia extrema),
                    la infracción de propiedad intelectual, la clonación de voces o rostros sin
                    consentimiento y la difusión de desinformación maliciosa.
                  </p>
                  <p>
                    También se prohíben fraudes, estafas, abuso técnico (scraping, ingeniería
                    inversa, sobrecarga de infraestructura) y automatización no autorizada.
                  </p>
                  <p>
                    KLIP podrá suspender o terminar cuentas ante incumplimientos y cooperará con
                    las autoridades competentes cuando sea necesario...
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  Consulta los textos completos en{" "}
                  <a
                    href="https://weareklip.com/viralizaloai/terms"
                    target="_blank"
                    className="underline text-primary"
                  >
                    Términos y Condiciones
                  </a>{" "}
                  y{" "}
                  <a
                    href="https://weareklip.com/viralizaloai/aup"
                    target="_blank"
                    className="underline text-primary"
                  >
                    Política de Uso Aceptable
                  </a>
                  .
                </p>
              </div>
            </Card>

            {/* ✅ Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={acceptTerms}
                  onCheckedChange={(v) => setAcceptTerms(Boolean(v))}
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-muted-foreground leading-snug"
                >
                  Acepto los{" "}
                  <a
                    href="https://weareklip.com/viralizaloai/terms"
                    target="_blank"
                    className="underline text-primary"
                  >
                    Términos y Condiciones
                  </a>
                  {" "}y la{" "}
                  <a
                    href="https://weareklip.com/viralizaloai/aup"
                    target="_blank"
                    className="underline text-primary"
                  >
                    Política de Uso Aceptable
                  </a>
                </label>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="aup"
                  checked={acceptAup}
                  onCheckedChange={(v) => setAcceptAup(Boolean(v))}
                />
                <label
                  htmlFor="aup"
                  className="text-sm text-muted-foreground leading-snug"
                >
                  Declaro que soy titular o tengo autorización de la voz/imagen que subo y autorizo su clonación/uso para generar contenido; no suplantaré a terceros.
                </label>
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Sube tu vídeo de clonación</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {/* 📹 Izquierda: tutorial + checklist */}
            <div className="space-y-4">
              <div className="aspect-video rounded-lg overflow-hidden border border-border">
                <video
                  src="https://firebasestorage.googleapis.com/v0/b/klip-6e9a8.firebasestorage.app/o/Tutorial%20grabación.mov?alt=media"
                  controls
                  preload="metadata"
                  playsInline
                  autoPlay
                  poster="https://firebasestorage.googleapis.com/v0/b/klip-6e9a8.firebasestorage.app/o/video-cover.jpeg?alt=media"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* ✅ Requisitos */}
              <div className="space-y-2 text-sm">
                <p className="font-medium">Requisitos del vídeo:</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500" />
                    Formato vertical (9:16)
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500" />
                    Máximo {MAX_VIDEO_MB} MB
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500" />
                    Fondo liso y buena iluminación
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500" />
                    Hablar de frente y con claridad
                  </li>
                </ul>
              </div>
            </div>

            {/* 📤 Derecha: Dropzone o vídeo cargado */}
            <div>
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
                  <p className="text-xs text-muted-foreground">
                    Solo vídeo • Máx {MAX_VIDEO_MB} MB • Formato 9:16
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <video src={videoDoc.url} controls className="w-full max-h-80 object-cover" />
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Vídeo listo</span>
                    <Button variant="outline" size="sm" onClick={removeVideo}>
                      Reemplazar
                    </Button>
                  </div>
                </div>
              )}

              {uploadingVideo && (
                <div className="flex items-center gap-3 mt-4">
                  <Progress value={videoProgressPct} className="w-48" />
                  <span className="text-xs">{videoProgressPct}%</span>
                </div>
              )}
            </div>
          </div>
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
                  !validStep1 || !subscribed
                }
              >
                Finalizar
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
