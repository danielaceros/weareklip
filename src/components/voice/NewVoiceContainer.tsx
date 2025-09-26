// src/components/voice/NewVoiceContainer.tsx
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
import { Button } from "@/components/ui/button";
import { validateFileSizeAs } from "@/lib/fileLimits";
import { useT } from "@/lib/i18n";

type VoiceCreateOk = { voice_id: string; requires_verification?: boolean };
type VoiceCreateErr = { error?: string; message?: string };

// 🔹 Límites
const MIN_DURATION = 180;   // 3 minutos
const MAX_DURATION = 1800;  // 30 minutos

export default function NewVoiceContainer() {
  const t = useT();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [samples, setSamples] = useState<
    { name: string; duration: number; url: string; storagePath: string }[]
  >([]);

  const totalDuration = useMemo(
    () => samples.reduce((acc, s) => acc + (s.duration || 0), 0),
    [samples]
  );
  const [recording, setRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const [voiceTitle, setVoiceTitle] = useState("");
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

  const getAudioDurationFromFile = (file: File): Promise<number> =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = document.createElement("audio");
      audio.src = url;
      audio.addEventListener("loadedmetadata", () => {
        resolve(audio.duration);
        URL.revokeObjectURL(url);
      });
      audio.addEventListener("error", () => {
        resolve(0);
        URL.revokeObjectURL(url);
      });
    });

  const uploadToFirebase = useCallback(
    async (file: File) => {
      if (!user) {
        toast.error(t("edit.create.toasts.mustLogin"));
        return;
      }

      const rawExt = file.type.split("/")[1] || "webm";
      const safeExt = rawExt === "x-m4a" ? "m4a" : rawExt;
      const fileName = `sample-${Date.now()}.${safeExt}`;
      const storagePath = `users/${user.uid}/voices/${fileName}`;
      const storageRef = ref(storage, storagePath);

      // Duración optimista
      const tempUrl = URL.createObjectURL(file);
      const localDuration = await getAudioDurationFromFile(file);

      // Añadir sample optimista
      setSamples((prev) => [
        ...prev,
        {
          name: fileName,
          duration: localDuration,
          url: tempUrl,
          storagePath,
        },
      ]);

      // marcador “sincronizando”
      setUploadProgress((prev) => ({ ...prev, [fileName]: -1 }));

      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          null,
          (error) => {
            toast.error(
              t("voices.new.toasts.uploadError", { name: file.name })
            );
            setUploadProgress((prev) => {
              const next = { ...prev };
              delete next[fileName];
              return next;
            });
            reject(error);
          },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            let duration = localDuration;
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
              next[fileName] = 100;
              return next;
            });
            toast.success(
              t("voices.new.toasts.uploaded", { name: file.name })
            );
            resolve();
          }
        );
      });
    },
    [user, storage, t]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!user) {
        toast.error(t("edit.create.toasts.mustLogin"));
        return;
      }
      for (const file of acceptedFiles) {
        try {
          const v = validateFileSizeAs(file, "audio");
          if (!v.ok) {
            toast.error(t("edit.create.dropzone.fileTooLarge"), {
              description: v.message,
            });
            continue;
          }
          await uploadToFirebase(file);
        } catch (err) {
          console.error(err);
          toast.error(t("voices.new.toasts.processError", { name: file.name }));
        }
      }
    },
    [user, uploadToFirebase, t]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejs) => {
      rejs.forEach((r) =>
        toast.error(t("voices.new.toasts.invalidFile"), {
          description: r.errors?.[0]?.message,
        })
      );
    },
    accept: { "audio/*": [] },
    multiple: true,
    validator: (file: File) => {
      const maxSize = 9 * 1024 * 1024; // 9 MB
      if (file.size > maxSize) {
        return {
          code: "file-too-large",
          message: t("voices.new.errors.maxSize", { mb: 9 }),
        };
      }
      return null;
    },
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
          toast.error(t("voices.new.toasts.audioTooLarge"), {
            description: v.message,
          });
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        await uploadToFirebase(file);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      toast(t("voices.new.toasts.recording"));
    } catch {
      toast.error(t("voices.new.toasts.micAccessError"));
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
    setSamples((prev) => prev.filter((s) => s.name !== sampleName));
    try {
      await deleteObject(ref(storage, `users/${user.uid}/voices/${sampleName}`));
      toast("🗑 " + t("voices.new.toasts.sampleDeleted"));
    } catch {
      toast.error(t("voices.new.toasts.sampleDeleteError"));
    }
  };

  const createVoice = async () => {
    if (inFlight.current || submitting) return;
    inFlight.current = true;
    setSubmitting(true);

    try {
      if (!user) {
        toast.error(t("edit.create.toasts.mustLogin"));
        return;
      }
      if (samples.length === 0) {
        toast.error(t("voices.new.toasts.needAtLeastOneSample"));
        return;
      }

      const ok = await ensureSubscribed({ feature: "elevenlabs-voice" });
      if (!ok) {
        setShowCheckout(true);
        return;
      }

      const token = await user.getIdToken(true);
      const resList = await fetch(`/api/firebase/users/${user.uid}/voices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = (await resList.json().catch(() => [])) as any[];
      if (Array.isArray(list) && list.length >= 1) {
        toast.error(t("voices.new.toasts.limitReached"));
        return;
      }

      const idem = uuidv4();
      const paths = samples.map((s) => s.storagePath);
      const finalName = (voiceTitle || "").trim() || `Voz-${Date.now()}`;

      toast.loading(t("voices.new.toasts.creating"));

      const res = await fetch("/api/elevenlabs/voice/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Idempotency-Key": idem,
        },
        body: JSON.stringify({ paths, voiceName: finalName }),
      });

      if (res.status === 409) {
        toast.message(t("voices.new.toasts.alreadyCreating"));
        return;
      }

      let data: VoiceCreateOk | VoiceCreateErr;
      try {
        data = (await res.json()) as VoiceCreateOk | VoiceCreateErr;
      } catch {
        const txt = await res.text().catch(() => "");
        data = { error: txt || t("voices.new.toasts.invalidResponse") };
      }

      toast.dismiss();

      if (!res.ok) {
        const msg =
          ("error" in data && data.error) ||
          ("message" in data && data.message) ||
          `HTTP ${res.status}`;
        toast.error(msg);
        return;
      }

      if (!("voice_id" in data) || typeof data.voice_id !== "string") {
        toast.error(t("voices.new.toasts.invalidResponse"));
        return;
      }

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

      toast.success(t("voices.new.toasts.created"));
      router.push("/dashboard/clones");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error(t("voices.new.toasts.createConnectionError"));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const [page, setPage] = useState(1);
  const perPage = 1;
  const totalPages = Math.ceil(samples.length / perPage);
  const paginated = samples.slice((page - 1) * perPage, page * perPage);

  // Estado visual de duración
  const durationState = useMemo(() => {
    if (totalDuration < MIN_DURATION) return "insuficiente";
    if (totalDuration <= 600) return "optimo";
    if (totalDuration <= MAX_DURATION) return "exceso";
    return "bloqueado";
  }, [totalDuration]);

  return (
    <div className="max-w-6xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-6 text-center md:text-left">
        {t("voices.new.title")}
      </h1>

      {/* Nombre de la voz */}
      <div className="mb-6">
        <Label className="text-sm font-medium" htmlFor="voice-title">
          {t("voices.new.labels.nameOptional")}
        </Label>
        <Input
          id="voice-title"
          value={voiceTitle}
          onChange={(e) => setVoiceTitle(e.target.value)}
          placeholder={t("voices.new.placeholders.name")}
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
              <h3 className="font-medium text-sm">
                {t("voices.new.tips.noise.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("voices.new.tips.noise.body")}
              </p>
            </div>
            <div className="p-2">
              <Mic className="mx-auto h-5 w-5 mb-1 text-muted-foreground" />
              <h3 className="font-medium text-sm">
                {t("voices.new.tips.gear.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("voices.new.tips.gear.body")}
              </p>
            </div>
            <div className="p-2">
              <CheckCircle2 className="mx-auto h-5 w-5 mb-1 text-muted-foreground" />
              <h3 className="font-medium text-sm">
                {t("voices.new.tips.quality.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("voices.new.tips.quality.body")}
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
              {t("voices.new.dropzone.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("voices.new.dropzone.hint", { mb: 9 })}
            </p>
            <span className="mt-2 text-xs text-muted-foreground">
              {t("voices.new.dropzone.or")}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                recording ? stopRecording() : startRecording();
              }}
              className="mt-3 px-4 py-2 rounded-lg border hover:bg-muted transition text-sm"
            >
              {recording
                ? t("voices.new.buttons.stopRecording")
                : t("voices.new.buttons.startRecording")}
            </button>
          </div>

          {/* progreso total */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <Progress
                value={(Math.min(totalDuration, MAX_DURATION) / MAX_DURATION) * 100}
                className="flex-1"
              />
              <span className="text-sm font-medium whitespace-nowrap">
                {t("voices.samples.progressLabel", {
                  seconds: Math.round(totalDuration),
                  max: MAX_DURATION,
                })}
              </span>
            </div>
            {durationState === "insuficiente" && (
              <p className="text-sm text-destructive">
                {t("voices.new.duration.hints.insufficient", { min: MIN_DURATION })}
              </p>
            )}
            {durationState === "optimo" && (
              <p className="text-sm text-green-600">
                {t("voices.new.duration.hints.optimal")}
              </p>
            )}
            {durationState === "exceso" && (
              <p className="text-sm text-yellow-600">
                {t("voices.new.duration.hints.excess")}
              </p>
            )}
            {durationState === "bloqueado" && (
              <p className="text-sm text-destructive">
                {t("voices.new.duration.hints.blocked", { minutes: 30 })}
              </p>
            )}
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

      <div className="p-5 w-full flex justify-center lg:justify-center">
        <Button
          onClick={createVoice}
          disabled={
            submitting ||
            samples.length === 0 ||
            totalDuration > MAX_DURATION
          }
          aria-busy={submitting}
          className="w-full sm:w-auto"
          data-paywall
          data-paywall-feature="elevenlabs-voice"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitting
            ? t("voices.new.buttons.creating")
            : t("voices.new.buttons.generate")}
        </Button>
      </div>

      <CheckoutRedirectModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        plan="ACCESS"
        message={t("audioCreator.paywall")}
      />
    </div>
  );
}
