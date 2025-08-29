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
import {
  Mic,
  UploadCloud,
  CheckCircle2,
  VolumeX,
} from "lucide-react";

type VoiceCreateOk = { voice_id: string; requires_verification?: boolean };
type VoiceCreateErr = { error?: string; message?: string };

export default function NewVoiceContainer() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [samples, setSamples] = useState<{ name: string; duration: number; url: string }[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const storage = getStorage();

  const { ensureSubscribed } = useSubscriptionGate();

  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);

  useEffect(() => {
    if (user) void fetchSamples();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
      const folderRef = ref(storage, `users/${user.uid}/voice-samples`);
      const res = await listAll(folderRef);
      const filesData = await Promise.all(
        res.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          const duration = await getAudioDurationFromURL(url);
          return { name: itemRef.name, duration, url };
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
      toast.error("Error cargando muestras desde Firebase");
    }
  }, [user, storage]);

  const uploadToFirebase = useCallback(
    async (file: File) => {
      if (!user) {
        toast.error("Debes iniciar sesión");
        return;
      }
      const rawExt = file.type.split("/")[1] || "webm";
      const safeExt = rawExt === "x-m4a" ? "m4a" : rawExt;
      const fileName = `voice-sample-${Date.now()}.${safeExt}`;

      const storageRef = ref(storage, `users/${user.uid}/voice-samples/${fileName}`);
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
      await deleteObject(ref(storage, `users/${user.uid}/voice-samples/${sampleName}`));
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

    const ok = await ensureSubscribed({ feature: "elevenlabs-voice" });
    if (!ok) return;

    try {
      const idToken = await user.getIdToken(true);
      const idem = uuidv4();

      const paths = samples
        .map((s) => {
          try {
            const u = new URL(s.url);
            const m = u.pathname.match(/\/o\/(.+)$/);
            const p = m ? decodeURIComponent(m[1]) : "";
            return p.split("?")[0];
          } catch {
            const decoded = decodeURIComponent(s.url);
            const m = decoded.match(/\/o\/(.+?)\?/);
            return m ? m[1] : "";
          }
        })
        .filter(Boolean);

      toast.loading("Creando voz en ElevenLabs...");

      // 🔹 Llamada a nuestro backend que conecta con ElevenLabs
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

      // ✅ Guardar en Firestore vía CRUD API
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
      router.push("/dashboard/voice");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error((err as Error).message || "Error de conexión al crear la voz");
    }
  };


  return (
    <div className="max-w-6xl w-full mx-auto py-8"> 
      <h1 className="text-3xl font-bold mb-6">Clonación de voz</h1>

      {/* Grid principal */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
        {/* Columna izquierda */}
        <div className="space-y-6">
          {/* Tips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div>
              <VolumeX className="mx-auto h-6 w-6 mb-2" />
              <h3 className="font-semibold">Evita entornos ruidosos</h3>
              <p className="text-sm text-muted-foreground">
                Los sonidos de fondo interfieren con la calidad de la grabación.
              </p>
            </div>
            <div>
              <Mic className="mx-auto h-6 w-6 mb-2" />
              <h3 className="font-semibold">Usa equipo consistente</h3>
              <p className="text-sm text-muted-foreground">
                No cambies el equipo de grabación entre muestras.
              </p>
            </div>
            <div>
              <CheckCircle2 className="mx-auto h-6 w-6 mb-2" />
              <h3 className="font-semibold">Comprueba la calidad</h3>
              <p className="text-sm text-muted-foreground">
                Escucha y revisa la grabación antes de subirla.
              </p>
            </div>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
              isDragActive ? "border-primary bg-muted/40" : "border-border"
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="h-6 w-6 mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Haz clic para subir o arrastra y suelta</p>
            <p className="text-xs text-muted-foreground">
              Archivos de audio o vídeo de hasta 10 MB cada uno
            </p>
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

          {/* Progreso */}
          <div className="flex items-center gap-4">
            <Progress value={(totalDuration / 120) * 100} className="flex-1" />
            <span className="text-sm font-medium">
              {Math.round(totalDuration)} / 120
            </span>
          </div>

          {/* Botón generar */}
          <div className="flex justify-end">
            <button
              onClick={createVoice}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
              data-paywall
              data-paywall-feature="elevenlabs-voice"
            >
              Generar audio
            </button>
          </div>
        </div>

        {/* Columna derecha: muestras */}
        <div>
          <VoiceSamplesList
            samples={samples}
            uploadProgress={uploadProgress}
            onRemove={removeSample}
          />
        </div>
      </div>
    </div>
  );
}
