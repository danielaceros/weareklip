// src/components/voice/NewVoiceContainer.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { onAuthStateChanged, getAuth, type User } from "firebase/auth";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
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
import { ProgressBar } from "./ProgressBar";
import useSubscriptionGate from "@/hooks/useSubscriptionGate";
import { v4 as uuidv4 } from "uuid";

type VoiceCreateOk = { voice_id: string; requires_verification?: boolean };
type VoiceCreateErr = { error?: string; message?: string };

export default function NewVoiceContainer() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [samples, setSamples] = useState<
    { name: string; duration: number; url: string }[]
  >([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
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
        toast.error(
          "⚠ Has superado el límite de 3 minutos, elimina muestras para continuar."
        );
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

      const storageRef = ref(
        storage,
        `users/${user.uid}/voice-samples/${fileName}`
      );
      const uploadTask = uploadBytesResumable(storageRef, file);

      toast(`📤 Subiendo ${file.name}...`);

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

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "audio/*": [] },
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
        ref(storage, `users/${user.uid}/voice-samples/${sampleName}`)
      );
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

      // Extrae los paths de Storage desde las URLs de descarga
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

      // Parse seguro: JSON o texto
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
        console.error("voice/create error:", res.status, data);
        toast.error(msg);
        return;
      }

      if (!("voice_id" in data) || typeof data.voice_id !== "string") {
        toast.error("Respuesta inválida del servidor");
        return;
      }

      const { getFirestore, doc, setDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const db = getFirestore();

      await setDoc(doc(db, `users/${user.uid}/voices/${data.voice_id}`), {
        voice_id: data.voice_id,
        requires_verification:
          "requires_verification" in data
            ? data.requires_verification
            : undefined,
        name: `Voz-${Date.now()}`,
        paths,
        created_at: serverTimestamp(),
        idem,
      });

      toast.success(`✅ Voz creada y guardada con ID: ${data.voice_id}`);
      router.push("/dashboard/voice");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(
        (err as Error).message || "Error de conexión al crear la voz"
      );
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">🎤 Crear nueva voz</h1>

      {/* Drag & Drop */}
      <div
        {...getRootProps()}
        className="border-2 border-dashed p-6 rounded-lg text-center cursor-pointer hover:border-blue-500"
      >
        <input {...getInputProps()} />
        <p className="text-gray-500">
          Arrastra y suelta muestras (máx 5 MB, máx 30s) o haz clic aquí
        </p>
      </div>

      {/* Botón grabación */}
      <div className="mt-6 flex gap-4 items-center">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`px-6 py-3 rounded-full text-white font-semibold transition ${
            recording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {recording ? "⏹ Detener grabación" : "🎙 Grabar muestra"}
        </button>
      </div>

      <ProgressBar totalDuration={totalDuration} />
      <VoiceSamplesList
        samples={samples}
        uploadProgress={uploadProgress}
        onRemove={removeSample}
      />

      {/* Botón Crear Voz */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={createVoice}
          className="px-6 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-semibold transition"
          data-paywall
          data-paywall-feature="elevenlabs-voice"
        >
          🚀 Crear voz en ElevenLabs
        </button>
      </div>
    </div>
  );
}
