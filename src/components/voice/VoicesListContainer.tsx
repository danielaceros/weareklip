"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Play, Pause } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import NewVoiceContainer from "./NewVoiceContainer";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { Spinner } from "@/components/ui/shadcn-io/spinner";

interface VoiceData {
  voiceId: string;
  name: string;
  createdAt?: { seconds: number; nanoseconds: number };
  preview_url?: string;
}

interface Props {
  variant?: "default" | "card";
  title?: string;
}

export default function VoicesListContainer({
  variant = "default",
  title = "Audios para la clonación",
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [voices, setVoices] = useState<VoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [page, setPage] = useState(1);
  const perPage = 8;

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  const fetchVoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();

      const res = await fetch(`/api/firebase/users/${user.uid}/voices`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error("Error fetching voices");

      const data = await res.json();

      const rawVoices: VoiceData[] = data.map((d: any) => ({
        voiceId: d.id,
        ...(d as Omit<VoiceData, "voiceId">),
      }));

      setVoices(rawVoices);
    } catch (err) {
      console.error("Error fetching voices:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchVoices();
  }, [fetchVoices]);

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    setDeleting(true);

    try {
      const idToken = await user.getIdToken();

      // 1️⃣ Eliminar en ElevenLabs (POST con body)
      const resEleven = await fetch(`/api/elevenlabs/voice/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ voiceId: deleteTarget }),
      });

      if (!resEleven.ok) {
        const errText = await resEleven.text();
        throw new Error(`Error eliminando en ElevenLabs: ${errText}`);
      }

      // 2️⃣ Eliminar en Firebase
      const resFirebase = await fetch(
        `/api/firebase/users/${user.uid}/voices/${deleteTarget}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!resFirebase.ok) {
        const errText = await resFirebase.text();
        throw new Error(`Error eliminando en Firebase: ${errText}`);
      }

      // 3️⃣ Actualizar estado local
      setVoices((prev) => prev.filter((v) => v.voiceId !== deleteTarget));
      setDeleteTarget(null);
    } catch (err) {
      console.error("❌ Error eliminando voz:", err);
    } finally {
      setDeleting(false);
    }
  };



  const totalPages = Math.ceil(voices.length / perPage);
  const paginated = voices.slice((page - 1) * perPage, page * perPage);

  return (
    <section
      className={`${
        variant === "card"
          ? "border border-border rounded-lg p-6 bg-card text-card-foreground shadow-sm"
          : ""
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Button onClick={() => setOpen(true)}>+ Nueva voz</Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Spinner size="lg" variant="ellipsis" />
        </div>
      ) : voices.length === 0 ? (
        <p className="text-muted-foreground">No tienes voces aún.</p>
      ) : (
        <div className="flex flex-col h-full space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((voice) => (
              <VoiceCard
                key={voice.voiceId}
                voice={voice}
                onDelete={() => setDeleteTarget(voice.voiceId)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-auto">
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
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl w-full">
          <NewVoiceContainer />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
        title="Eliminar voz"
        description="¿Seguro que quieres eliminar esta voz? Esta acción no se puede deshacer."
      />
    </section>
  );
}

function VoiceCard({
  voice,
  onDelete,
}: {
  voice: VoiceData;
  onDelete: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    voice.preview_url ?? null
  );
  const [loadingPreview, setLoadingPreview] = useState(!voice.preview_url);

  useEffect(() => {
    if (!previewUrl && voice.voiceId) {
      const fetchPreview = async () => {
        try {
          const res = await fetch(`/api/voice/get?voiceId=${voice.voiceId}`);
          const data = await res.json();
          if (res.ok && data.preview_url) {
            setPreviewUrl(data.preview_url);
          }
        } catch (err) {
          console.error("❌ Error cargando preview de la voz:", err);
        } finally {
          setLoadingPreview(false);
        }
      };
      fetchPreview();
    } else {
      setLoadingPreview(false);
    }
  }, [previewUrl, voice.voiceId]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn("No se pudo reproducir:", err);
      });
    }
  };

  return (
    <Card className="p-4 flex flex-col rounded-2xl bg-card border border-border shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold truncate">
          {voice.name || "Sin nombre"}
        </h3>
        <button
          onClick={onDelete}
          className="p-2 rounded-full hover:bg-muted transition"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </button>
      </div>

      {loadingPreview ? (
        <div className="flex justify-center items-center h-20">
          <Spinner size="sm" variant="ellipsis" />
        </div>
      ) : previewUrl ? (
        <div className="flex items-center gap-3 w-full">
          <button
            onClick={togglePlay}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-border hover:bg-muted transition shrink-0"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <div className="flex-1 w-full">
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              readOnly
              className="w-full accent-primary"
            />
          </div>

          <audio
            ref={audioRef}
            src={previewUrl}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              setProgress((el.currentTime / el.duration) * 100 || 0);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setProgress(0);
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">🎧 Preview no disponible</p>
      )}
    </Card>
  );
}

