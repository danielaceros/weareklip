"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import { Mic, UploadCloud, CheckCircle2, VolumeX } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import CheckoutRedirectModal from "@/components/shared/CheckoutRedirectModal";

type VoiceCreateOk = { voice_id: string; requires_verification?: boolean };
type VoiceCreateErr = { error?: string; message?: string };

/** Helper estable (fuera del componente) */
function getAudioDurationFromURL(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.src = url;
    audio.addEventListener("loadedmetadata", () => resolve(audio.duration));
    audio.addEventListener("error", (e) => reject(e));
  });
}

export default function NewVoiceContainer() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [samples, setSamples] = useState<
    { name: string; duration: number; url: string; storagePath: string }[]
  >([]);

  const [totalDuration, setTotalDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const storage = getStorage();

  const { ensureSubscribed } = useSubscriptionGate();
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);

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
        toast.error("⚠ Has superado el límite de 3 minutos, elimina muestras para continuar.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error cargando muestras desde el almacenamiento");
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
      const rawExt = file.type.split("/")[1] || "webm";
      const safeExt = rawExt === "x-m4a" ? "m4a" : rawExt;
      const fileName = `sample-${Date.now()}.${safeExt}`;

      const storagePath = `users/${user.uid}/voices/${fileName}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      toast(`📤 Subiendo ${file.name}...`);

      return new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress((prev) => ({ ...prev, [fileName]: progress }));
          },
          (error) => {
            toast.error(`Error al subir ${file.name}`);
            setUploadProgress((prev) => {
              const next = { ...prev };
              delete next[fileName];
              return next;
            });
            reject(error);
          },
          async () => {
            toast.success(`✅ ${file.name} subida correctamente`);
            setUploadProgress((prev) => {
              const next = { ...prev };
              delete next[fileName];
              return next;
            });
            await fetchSamples();
            resolve();
          }
        );
      });
    },
    [user, fetchSamples, storage]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!user) {
        toast.error("Debes iniciar sesión");
        return;
      }
      for (const file of acceptedFiles) {
        try {
          await uploadToFirebase(file);
        } catch (err) {
          console.error(err);
          toast.error(`Error procesando ${file.name}`);
        }
      }
    },
    [user, uploadToFirebase]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
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
        const file = new File([blob], `recording-${Date.now()}.webm`, {
          type: "audio/webm",
        });
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const removeSample = async (sampleName: string) => {
    if (!user) return;
    try {
      await deleteObject(ref(storage, `users/${user.uid}/voices/${sampleName}`));
      toast("🗑 Muestra eliminada");
      await fetchSamples();
    } catch {
      toast.error("Error al eliminar muestra");
    }
  };

  const createVoice = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }
    if (samples.length === 0) {
      toast.error("Debes subir al menos una muestra de voz");
      return;
    }

    // Mantenemos el ID interno para no romper gating.
    const ok = await ensureSubscribed({ feature: "voice" });
    if (!ok) {
      setShowCheckout(true);
      return;
    }

    try {
      const idToken = await user.getIdToken(true);
      const idem = uuidv4();

      const paths = samples.map((s) => s.storagePath);
      // Texto neutral (sin marcas de proveedor)
      toast.loading("Generando voz…");

      // Ruta genérica para no exponer proveedor en Network
      const res = await fetch("/api/voice/create", {
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

      const saveRes = await fetch(
        `/api/firebase/users/${user.uid}/voices/${data.voice_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            voice_id: data.voice_id,
            requires_verification:
              "requires_verification" in data ? data.requires_verification : undefined,
            name: `Voz-${Date.now()}`,
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

      toast.success(`✅ Voz creada y guardada con ID: ${data.voice_id}`);
      router.push("/dashboard/clones");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error((err as Error).message || "Error de conexión al crear la voz");
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-8">
        {/* Columna izquierda */}
        <div className="space-y-6">
          {/* Tips */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-2">
              <VolumeX className="mx-auto h-5 w-5 mb-1 text-muted-foreground" />
              <h3 className="font-medium text-sm">Evita entornos ruidosos</h3>
              <p className="text-xs text-muted-foreground">
                Los sonidos de fondo interfieren con la calidad de la grabación.
              </p>
            </div>
            <div className="p-2">
              <Mic className="mx-auto h-5 w-5 mb-1 text-muted-foreground" />
              <h3 className="font-medium text-sm">Usa equipo consistente</h3>
              <p className="text-xs text-muted-foreground">
                No cambies el equipo de grabación entre muestras.
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
              Archivos de audio o vídeo de hasta 10 MB cada uno
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

          {/* Progreso (coherente con 180 s) */}
          <div className="flex items-center gap-4">
            <Progress value={(totalDuration / 180) * 100} className="flex-1" />
            <span className="text-sm font-medium whitespace-nowrap">
              {Math.round(totalDuration)} / 180
            </span>
          </div>

          {/* Botón generar */}
          <div className="flex justify-center lg:justify-end">
            <button
              onClick={createVoice}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition w-full sm:w-auto"
              data-paywall
              data-paywall-feature="voice"  // mantenido para compatibilidad
            >
              Generar audio
            </button>
          </div>
        </div>

        {/* Columna derecha */}
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

      {/* Modal */}
      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message="Para clonar tu voz necesitas suscripción activa, empieza tu prueba GRATUITA de 7 días"
      />
    </div>
  );
}

