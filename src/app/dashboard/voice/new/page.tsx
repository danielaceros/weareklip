"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { onAuthStateChanged, getAuth, User } from "firebase/auth";
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

export default function NewVoicePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [samples, setSamples] = useState<{ name: string; duration: number; url: string }[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const storage = getStorage();

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
  }, []);

  const getAudioDurationFromURL = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = document.createElement("audio");
      audio.src = url;
      audio.addEventListener("loadedmetadata", () => resolve(audio.duration));
      audio.addEventListener("error", (e) => reject(e));
    });
  };

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
    }, [user, storage]); // quitamos storage


  const uploadToFirebase = useCallback(
  async (file: File) => {
    if (!user) {
      toast.error("Debes iniciar sesión");
      return;
    }
    // Validaciones...
    const fileName = `voice-sample-${Date.now()}.${file.type.split("/")[1] || "webm"}`;
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
            const newState = { ...prev };
            delete newState[fileName];
            return newState;
          });
          reject(error);
        },
        async () => {
          toast.success(`✅ ${file.name} subida correctamente`);
          setUploadProgress((prev) => {
            const newState = { ...prev };
            delete newState[fileName];
            return newState;
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
      const file = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });

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
            recording ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
          }`}
        >
          {recording ? "⏹ Detener grabación" : "🎙 Grabar muestra"}
        </button>
      </div>

      {/* Barra total */}
      <ProgressBar totalDuration={totalDuration} />

      {/* Lista de muestras */}
      {samples.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="font-semibold">Muestras:</h2>
          {samples.map(({ name, duration, url }) => (
            <div key={name} className="flex flex-col gap-2 p-3 bg-gray-100 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium break-all">{name}</p>
                  <p className="text-xs text-gray-500">{Math.round(duration)} segundos</p>
                </div>
                <button
                  onClick={() => removeSample(name)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  ❌ Eliminar
                </button>
              </div>
              {uploadProgress[name] !== undefined ? (
                <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 transition-all duration-200"
                    style={{ width: `${uploadProgress[name]}%` }}
                  />
                </div>
              ) : (
                <audio controls src={url} className="w-full" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botón Crear Voz */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={async () => {
            if (!user) {
              toast.error("Debes iniciar sesión");
              return;
            }
            if (samples.length === 0) {
              toast.error("Debes subir al menos una muestra de voz");
              return;
            }

            try {
              const paths = samples
                .map((s) => {
                  const decoded = decodeURIComponent(s.url);
                  const match = decoded.match(/o\/(.+?)\?/);
                  return match ? match[1] : "";
                })
                .filter(Boolean);

              toast.loading("Creando voz en ElevenLabs...");

              const res = await fetch("/api/elevenlabs/voice/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paths,
                  voiceName: `Voz-${Date.now()}`,
                }),
              });

              toast.dismiss();

              const data = await res.json();
              if (!res.ok) {
                toast.error(data.error || "Error al crear voz");
                return;
              }

              const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
              const db = getFirestore();

              await setDoc(doc(db, `users/${user.uid}/voices/${data.voice_id}`), {
                voice_id: data.voice_id,
                requires_verification: data.requires_verification,
                name: `Voz-${Date.now()}`,
                paths,
                created_at: serverTimestamp(),
              });

              toast.success(`✅ Voz creada y guardada con ID: ${data.voice_id}`);
              router.push("/dashboard/voice");
            } catch (err) {
              console.error(err);
              toast.dismiss();
              toast.error("Error de conexión al crear la voz");
            }
          }}
          className="px-6 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-semibold transition"
        >
          🚀 Crear voz en ElevenLabs
        </button>
      </div>
    </div>
  );
}

function ProgressBar({ totalDuration }: { totalDuration: number }) {
  const percent = Math.min((totalDuration / 180) * 100, 100);
  const color = totalDuration < 120 ? "bg-green-500" : "bg-yellow-500";
  return (
    <div className="mt-6">
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`${color} h-4`}
          style={{ width: `${percent}%`, transition: "width 0.3s ease" }}
        />
      </div>
      <p className="text-xs mt-2 text-gray-500">{Math.floor(totalDuration)}s / 180s totales</p>
    </div>
  );
}
