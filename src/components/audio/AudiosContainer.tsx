"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";

import { Plus, Trash2 } from "lucide-react";
import { AudiosList, type AudioData } from "@/components/audio/AudiosList";
import AudioCreatorContainer from "@/components/audio/AudioCreatorContainer";

export default function AudiosContainer() {
  const searchParams = useSearchParams();

  const [audios, setAudios] = useState<AudioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [isNewOpen, setIsNewOpen] = useState(false);

  const [audioToDelete, setAudioToDelete] = useState<AudioData | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [page, setPage] = useState(1);
  const perPage = 9;

  /* 🔐 Auth */
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  /* 📥 Fetch */
  const fetchAudios = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/firebase/users/${user.uid}/audios`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data = await res.json();
      const mapped: AudioData[] = (data as any[]).map((d) => ({
        audioId: d.id,
        url: d.audioUrl ?? "",
        name: d.name ?? "",
        description: d.description ?? "",
        createdAt: d.createdAt,
        duration: d.duration,
        language: d.language,
      }));
      setAudios(mapped);
    } catch (err) {
      console.error("Error fetching audios:", err);
      toast.error("❌ No se pudieron cargar los audios");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAudios();
  }, [fetchAudios]);

  /* 🔓 Abrir modal con ?new=1 + limpiar URL */
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setIsNewOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  /* 🗑️ Borrado */
  const handleConfirmDelete = useCallback(async () => {
    if (!user) return;
    if (deleting) return;
    setDeleting(true);

    const prev = audios; // 👈 guardamos estado previo por si toca rollback

    try {
      const idToken = await user.getIdToken();

      if (deleteAll) {
        // 🔹 UI optimista: vaciamos la lista de inmediato
        setAudios([]);

        await Promise.all(
          prev.map((audio) =>
            fetch(`/api/firebase/users/${user.uid}/audios/${audio.audioId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${idToken}` },
            })
          )
        );

        toast.success("🗑️ Todos los audios eliminados");
      } else if (audioToDelete) {
        // 🔹 UI optimista: quitamos el audio antes de la respuesta del servidor
        setAudios((s) => s.filter((a) => a.audioId !== audioToDelete.audioId));

        const res = await fetch(
          `/api/firebase/users/${user.uid}/audios/${audioToDelete.audioId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );

        if (!res.ok) throw new Error("Error en borrado");
        toast.success("Audio eliminado ✅");
      }
    } catch (err) {
      console.error("Error eliminando audio:", err);
      toast.error("❌ No se pudo eliminar el audio");

      // 🔄 rollback si algo salió mal
      setAudios(prev);
    } finally {
      setDeleting(false);
      setAudioToDelete(null);
      setDeleteAll(false);
    }
  }, [user, audios, deleteAll, audioToDelete, deleting]);


  /* 🔢 Paginación */
  const totalPages = Math.max(1, Math.ceil(audios.length / perPage));
  const paginated = useMemo(
    () => audios.slice((page - 1) * perPage, page * perPage),
    [audios, page]
  );

  /* ⏳ Loader */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] w-full">
        <Spinner className="h-12 w-12 text-primary" variant="ellipsis" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Mis Audios</h1>
        <div className="flex gap-3">
          <Button
            variant="destructive"
            className="rounded-lg"
            onClick={() => setDeleteAll(true)}
            disabled={audios.length === 0 || deleting}
          >
            <Trash2 size={18} className="mr-2" />
            {deleting && deleteAll ? "Eliminando..." : "Borrar todos"}
          </Button>
          <Button
            onClick={() => setIsNewOpen(true)}
            className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            <Plus size={18} className="mr-2" />
            Nuevo audio
          </Button>
        </div>
      </div>

      {/* Lista */}
      <AudiosList
        audios={paginated}
        onDelete={(audio) => setAudioToDelete(audio)}
      />

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="pt-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
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
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Modal crear audio */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-3xl w-full rounded-xl">
          <AudioCreatorContainer
            onCreated={(newAudio) => {
              setIsNewOpen(false);
              // Optimistic UI: añadimos el nuevo audio a la lista
              setAudios((prev) => [newAudio, ...prev]);
              // ⚡ opcional: aún así refrescamos desde backend en background
              fetchAudios();
            }}
            onCancel={() => setIsNewOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Modal eliminar */}
      <ConfirmDeleteDialog
        open={!!audioToDelete || deleteAll}
        onClose={() => {
          setAudioToDelete(null);
          setDeleteAll(false);
        }}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
        title={deleteAll ? "Eliminar todos los audios" : "Eliminar audio"}
        description={
          deleteAll
            ? "¿Seguro que quieres eliminar TODOS los audios? Esta acción no se puede deshacer."
            : "¿Seguro que quieres eliminar este audio? Esta acción no se puede deshacer."
        }
        confirmText={deleteAll ? "Eliminar todos" : "Eliminar"}
      />
    </div>
  );
}
