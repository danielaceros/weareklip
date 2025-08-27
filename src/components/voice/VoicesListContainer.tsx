"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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

  // estado para borrar
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
    try {
      const ref = collection(db, "users", user.uid, "voices");
      const snapshot = await getDocs(ref);
      const rawVoices: VoiceData[] = snapshot.docs.map((doc) => ({
        voiceId: doc.id,
        ...(doc.data() as Omit<VoiceData, "voiceId">),
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
      await deleteDoc(doc(db, "users", user.uid, "voices", deleteTarget));
      setVoices((prev) => prev.filter((v) => v.voiceId !== deleteTarget));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error eliminando voz:", err);
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
        <p className="text-muted-foreground">Cargando voces...</p>
      ) : voices.length === 0 ? (
        <p className="text-muted-foreground">No tienes voces aún.</p>
      ) : (
        <div className="flex flex-col h-full space-y-6">
          {/* Grid */}
          <div
            className="
              grid gap-4 
              grid-cols-[repeat(auto-fill,minmax(320px,1fr))]
            "
          >
            {paginated.map((voice) => (
              <VoiceCard
                key={voice.voiceId}
                voice={voice}
                onDelete={() => setDeleteTarget(voice.voiceId)}
              />
            ))}
          </div>

          {/* Paginación */}
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

      {/* Modal Crear Voz */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl w-full">
          <NewVoiceContainer />
        </DialogContent>
      </Dialog>

      {/* Modal Confirmación de borrado */}
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

/* ---------- Voice Card ---------- */
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

  useEffect(() => {
    if (!previewUrl && voice.voiceId) {
      const fetchPreview = async () => {
        try {
          const res = await fetch(`/api/elevenlabs/voice/get?voiceId=${voice.voiceId}`);
          const data = await res.json();
          if (res.ok && data.preview_url) {
            setPreviewUrl(data.preview_url);
          }
        } catch (err) {
          console.error("❌ Error cargando preview de ElevenLabs:", err);
        }
      };
      fetchPreview();
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
      {/* Header */}
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

      {/* Player */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          disabled={!previewUrl}
          className="flex items-center justify-center w-8 h-8 rounded-full border border-border hover:bg-muted transition"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            readOnly
            className="w-full accent-primary"
          />
        </div>
      </div>

      {/* Hidden audio element */}
      {previewUrl && (
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
      )}
    </Card>
  );
}
