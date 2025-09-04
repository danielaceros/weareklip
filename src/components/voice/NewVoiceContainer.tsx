"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { onAuthStateChanged, getAuth, type User } from "firebase/auth";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { useRouter } from "next/navigation";
import { VoiceSamplesList } from "./VoiceSamplesList";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import { v4 as uuidv4 } from "uuid";
import { Progress } from "@/components/ui/progress";
import { Mic, UploadCloud, CheckCircle2, VolumeX, Loader2 } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button"; // ⬅️ nuevo

import { validateFileSizeAs } from "@/lib/fileLimits";

type VoiceCreateOk = { voice_id: string; requires_verification?: boolean };
type VoiceCreateErr = { error?: string; message?: string };

export default function NewVoiceContainer() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [samples, setSamples] = useState<
    { name: string; duration: number; url: string; storagePath: string }[]
  >([]);

  const [totalDuration, setTotalDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // 🏷️ nombre de la voz
  const [voiceTitle, setVoiceTitle] = useState("");

  // ⛔ anti-doble-click
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const storage = useMemo(() => getStorage(), []);
  const { ensureSubscribed } = useSubscriptionGate();
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);

  const getAudioDurationFromURL = (url: string): Promise<number> =>
    new Promise((resolve, reject) => {
      const audio = document.createElement("audio");
      audio.src = url;
      audio.addEventListener("loadedmetadata", () => resolve(audio.duration));
      audio.addEventListener("error", (e) => reject(e));
    });

  const fetchSamples = useCallback(async () => {
    if (!user) return;
    try {
      const folderRef = ref(storage, `users/${user.uid}/voices`);
      const res = await listAll(folderRef);
      const filesData = await Promise.all(
        res.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          const duration = await getAudioDurationFromURL(url);
          return {
            name: itemRef.name,
            duration,
            url,
            storagePath: itemRef.fullPath,
          };
        })
      );

      const total = filesData.reduce((acc, s) => acc + s.duration, 0);
      setSamples(filesData);
      setTotalDuration(total);

      if (total > 180) {
        toast.error(
          "⚠ Has superado el límite de 3 minutos, elimina muestras para continuar."
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Error cargando muestras desde Firebase");
    }
  }, [user, storage]);

  useEffect(() => {
    void fetchSamples();
  }, [fetchSamples]);

  const uploadToFirebase = useCallback(
    async (file: File) => {
      if (!user) {
        toast.error("Debes iniciar sesión");
        return;
      }

      const v = validateFileSizeAs(file, "audio");
      if (!v.ok) {
        toast.error("Archivo demasiado grande", { description: v.message });
        return;
      }

      const rawExt = file.type.split("/")[1] || "webm";
      const safeExt = rawExt === "x-m4a" ? "m4a" : rawExt;
      const fileName = `sample-${Date.now()}.${safeExt}`;

      const storagePath = `users/${user.uid}/voices/${fileName}`;
      const storageRef = ref(storage, storagePath);

      const tempUrl = URL.createObjectURL(file);
      setSamples((prev) => [
        ...prev,
        { name: fileName, duration: 0, url: tempUrl, storagePath },
      ]);
      setUploadProgress((prev) => ({ ...prev, [fileName]: 0 }));

      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setUploadProgress((prev) => ({ ...prev, [fileName]: progress }));
          },
          (error) => {
            toast.error(`Error al subir ${file.name}`);
            setUploadProgress((prev) => {
              const next = { ...prev };
              delete next[fileName];
              return next;
            });
            setSamples((prev) =>
              prev.filter((s) => s.storagePath !== storagePath)
            );
            reject(error);
          },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            let duration = 0;
            try {
              duration = await getAudioDurationFromURL(url);
            } catch {}
            setSamples((prev) =>
              prev.map((s) =>
                s.storagePath === storagePath ? { ...s, url, duration } : s
              )
            );
            setUploadProgress((prev) => {
              const next = { ...prev };
              delete next[fileName];
              return next;
            });
            toast.success(`✅ ${file.name} subida correctamente`);
            resolve();
          }
        );
      });
    },
    [user, storage]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!user) {
        toast.error("Debes iniciar sesión");
        return;
      }
      for (const file of acceptedFiles) {
        try {
          const v = validateFileSizeAs(file, "audio");
          if (!v.ok) {
            toast.error("Archivo demasiado grande", { description: v.message });
            continue;
          }
          await uploadToFirebase(file);
        } catch (err) {
          console.error(err);
          toast.error(`Error procesando ${file.name}`);
        }
      }
    },
    [user, uploadToFirebase]
  );

  const validator = (file: File) => {
    const v = validateFileSizeAs(file, "audio");
    return v.ok ? null : { code: "file-too-large", message: v.message };
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejs) => {
      rejs.forEach((r) =>
        toast.error("Archivo demasiado grande", {
          description: r.errors?.[0]?.message,
        })
      );
    },
    accept: { "audio/*": [], "video/*": [] },
    multiple: true,
    validator,
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
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        const v = validateFileSizeAs(file, "audio");
        if (!v.ok) {
          toast.error("Audio demasiado grande", { description: v.message });
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        await uploadToFirebase(file);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      toast("🎙 Grabando... habla claro");
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const removeSample = async (sampleName: string) => {
    if (!user) return;
    try {
      await deleteObject(
        ref(storage, `users/${user.uid}/voices/${sampleName}`)
      );
      toast("🗑 Muestra eliminada");
      await fetchSamples();
    } catch {
      toast.error("Error al eliminar muestra");
    }
  };

  const createVoice = async () => {
    if (inFlight.current || submitting) return; // ⛔ doble click
    inFlight.current = true;
    setSubmitting(true);

    try {
      if (!user) {
        toast.error("Debes iniciar sesión");
        return;
      }
      if (samples.length === 0) {
        toast.error("Debes subir al menos una muestra de voz");
        return;
      }

      const ok = await ensureSubscribed({ feature: "elevenlabs-voice" });
      if (!ok) {
        setShowCheckout(true);
        return;
      }

      // Pre-check de cuota en cliente (UX)
      const token = await user.getIdToken(true);
      const resList = await fetch(`/api/firebase/users/${user.uid}/voices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = (await resList.json().catch(() => [])) as any[];
      if (Array.isArray(list) && list.length >= 1) {
        toast.error("Has alcanzado el límite de 1 voz por cuenta.");
        return;
      }

      const idem = uuidv4();
      const paths = samples.map((s) => s.storagePath);
      const finalName = (voiceTitle || "").trim() || `Voz-${Date.now()}`;

      toast.loading("Creando voz en ElevenLabs...");

      // 1) Crear voz en ElevenLabs
      const res = await fetch("/api/elevenlabs/voice/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Idempotency-Key": idem, // 🔒 idempotencia
        },
        body: JSON.stringify({ paths, voiceName: finalName }),
      });

      if (res.status === 409) {
        toast.message("Ya estamos creando tu voz…");
        return;
      }

      let data: VoiceCreateOk | VoiceCreateErr;
      try {
        data = (await res.json()) as VoiceCreateOk | VoiceCreateErr;
      } catch {
        const txt = await res.text().catch(() => "");
        data = { error: txt || "Respuesta no JSON" };
      }

      toast.dismiss();

      if (!res.ok) {
        const msg =
          ("error" in data && data.error) ||
          ("message" in data && data.message) ||
          `HTTP ${res.status} al crear voz`;
        toast.error(msg);
        return;
      }

      if (!("voice_id" in data) || typeof data.voice_id !== "string") {
        toast.error("Respuesta inválida del servidor");
        return;
      }

      // 2) Guardar en Firestore el NOMBRE elegido
      const saveRes = await fetch(
        `/api/firebase/users/${user.uid}/voices/${data.voice_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            voice_id: data.voice_id,
            requires_verification:
              "requires_verification" in data
                ? (data as any).requires_verification
                : undefined,
            name: finalName,
            title: finalName,
            paths,
            createdAt: Date.now(),
            idem,
          }),
        }
      );

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        throw new Error(`Error guardando voz: ${errText}`);
      }

      toast.success(`✅ Voz creada y guardada`);
      router.push("/dashboard/clones");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(
        (err as Error).message || "Error de conexión al crear la voz"
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const [page, setPage] = useState(1);
  const perPage = 1;
  const totalPages = Math.ceil(samples.length / perPage);
  const paginated = samples.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="max-w-6xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6 text-center md:text-left">
        Clonación de voz
      </h1>

      {/* Nombre de la voz */}
      <div className="mb-6">
        <Label className="text-sm font-medium" htmlFor="voice-title">
          Nombre de la voz (opcional)
        </Label>
        <Input
          id="voice-title"
          value={voiceTitle}
          onChange={(e) => setVoiceTitle(e.target.value)}
          placeholder="Ej: Voz Eneko – iPhone mic"
          className="mt-2"
          maxLength={80}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-8">
        {/* izquierda */}
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-2">
              <VolumeX className="mx-auto h-5 w-5 mb-1 text-muted-foreground" />
              <h3 className="font-medium text-sm">Evita entornos ruidosos</h3>
              <p className="text-xs text-muted-foreground">
                Los sonidos de fondo interfieren con la calidad.
              </p>
            </div>
            <div className="p-2">
              <Mic className="mx-auto h-5 w-5 mb-1 text-muted-foreground" />
              <h3 className="font-medium text-sm">Usa equipo consistente</h3>
              <p className="text-xs text-muted-foreground">
                No cambies el equipo entre muestras.
              </p>
            </div>
            <div className="p-2">
              <CheckCircle2 className="mx-auto h-5 w-5 mb-1 text-muted-foreground" />
              <h3 className="font-medium text-sm">Comprueba la calidad</h3>
              <p className="text-xs text-muted-foreground">
                Escucha y revisa la grabación antes de subirla.
              </p>
            </div>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition w-full
              ${isDragActive ? "border-primary bg-muted/40" : "border-border"}`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="h-8 w-8 mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">
              Haz clic para subir o arrastra y suelta
            </p>
            <p className="text-xs text-muted-foreground">
              Audios o vídeos (como muestra) hasta 10&nbsp;MB
            </p>
            <span className="mt-2 text-xs text-muted-foreground">o</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                recording ? stopRecording() : startRecording();
              }}
              className="mt-3 px-4 py-2 rounded-lg border hover:bg-muted transition text-sm"
            >
              {recording ? "⏹ Detener" : "🎙 Grabar audio"}
            </button>
          </div>

          {/* progreso total */}
          <div className="flex items-center gap-4">
            <Progress value={(totalDuration / 120) * 100} className="flex-1" />
            <span className="text-sm font-medium whitespace-nowrap">
              {Math.round(totalDuration)} / 120
            </span>
          </div>

          {/* Botón generar (bloqueado mientras envía) */}
          <div className="flex justify-center lg:justify-end">
            <Button
              onClick={createVoice}
              disabled={submitting || samples.length === 0}
              aria-busy={submitting}
              className="w-full sm:w-auto"
              data-paywall
              data-paywall-feature="elevenlabs-voice"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? "Creando voz..." : "Generar audio"}
            </Button>
          </div>
        </div>

        {/* derecha */}
        <div className="w-full space-y-6">
          <div className="max-h-[400px] overflow-y-auto pr-2">
            <VoiceSamplesList
              samples={paginated}
              uploadProgress={uploadProgress}
              onRemove={removeSample}
            />
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={page === i + 1}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(i + 1);
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Para clonar tu voz necesitas suscripción activa, empieza tu prueba GRATUITA de 7 días"
      />
    </div>
  );
}
