"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

// ✅ Rutas correctas (tus componentes viven en src/app/components)
import { ScriptCard } from "@/components/script/ScriptCard";
import { ScriptModal } from "@/components/script/ScriptModal";
import ScriptCreatorContainer from "@/components/script/ScriptCreatorContainer";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";

import { Spinner } from "@/components/ui/shadcn-io/spinner";

interface ScriptData {
  scriptId: string;

  // 👇 NUEVO: para Share Link
  public?: boolean;
  uid_share?: string | null;

  isAI?: boolean;
  ctaText?: string;
  platform?: string;
  addCTA?: boolean;
  structure?: string;
  tone?: string;
  duration?: string;
  language?: string;
  description?: string;
  script?: string;
  rating?: number;
  createdAt?: { seconds: number; nanoseconds: number };
  fuente?: string;
  videoTitle?: string;
  videoDescription?: string;
  videoChannel?: string;
  videoPublishedAt?: string;
  videoViews?: number;
  videoThumbnail?: string;
}

export default function ScriptsContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [scripts, setScripts] = useState<ScriptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [selectedScript, setSelectedScript] = useState<ScriptData | null>(null);

  // Estados de borrado
  const [scriptToDelete, setScriptToDelete] = useState<ScriptData | null>(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [sortOption, setSortOption] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const perPage = 4;

  // 🔑 Auth
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // 📥 Fetch de scripts
  const fetchScripts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/firebase/users/${user.uid}/scripts`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data: any[] = await res.json();

      setScripts(
        data.map((doc) => ({
          scriptId: doc.id,

          // 👇 incluye public/uid_share
          public: doc.public ?? false,
          uid_share: doc.uid_share ?? null,

          description: doc.description,
          platform: doc.platform,
          language: doc.language,
          script: doc.script,
          createdAt: doc.createdAt,
          fuente: doc.fuente,
          isAI: doc.isAI,
          videoTitle: doc.videoTitle,
          videoDescription: doc.videoDescription,
          videoChannel: doc.videoChannel,
          videoPublishedAt: doc.videoPublishedAt,
          videoViews: doc.videoViews,
          videoThumbnail: doc.videoThumbnail,
        }))
      );
    } catch (error) {
      console.error("Error fetching scripts:", error);
      toast.error("No se pudieron cargar los guiones");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  // ✅ Abrir modal si venimos con ?new=1 y limpiar la URL
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setIsNewOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  // 🟠 Borrado con UI optimista
  const handleConfirmDelete = async () => {
    if (!user) return;
    setDeleting(true);

    try {
      const idToken = await user.getIdToken();

      if (deleteAll) {
        const prev = scripts;
        setScripts([]); // Optimista
        await Promise.all(
          prev.map((script) =>
            fetch(
              `/api/firebase/users/${user.uid}/scripts/${script.scriptId}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${idToken}` },
              }
            )
          )
        );
        toast.success("Todos los guiones han sido eliminados ✅");
      } else if (scriptToDelete) {
        const prev = scripts;
        setScripts((s) =>
          s.filter((sc) => sc.scriptId !== scriptToDelete.scriptId)
        );
        const res = await fetch(
          `/api/firebase/users/${user.uid}/scripts/${scriptToDelete.scriptId}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } }
        );
        if (!res.ok) throw new Error("Error en borrado");
        toast.success("Guion eliminado correctamente ✅");
      }
    } catch (err) {
      console.error("❌ Error eliminando guiones:", err);
      toast.error("No se pudieron eliminar los guiones");
      fetchScripts(); // rollback
    } finally {
      setDeleting(false);
      setScriptToDelete(null);
      setDeleteAll(false);
    }
  };

  // ⭐ Rating optimista
  const handleRating = async (scriptId: string, newRating: number) => {
    if (!user) return;
    const prev = scripts;
    setScripts((s) =>
      s.map((sc) =>
        sc.scriptId === scriptId ? { ...sc, rating: newRating } : sc
      )
    );
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(
        `/api/firebase/users/${user.uid}/scripts/${scriptId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ rating: newRating }),
        }
      );
      if (!res.ok) throw new Error("Error rating");
    } catch (err) {
      toast.error("No se pudo actualizar la valoración");
      setScripts(prev); // rollback
    }
  };

  // 📊 Orden y paginación memoizados
  const sortedScripts = useMemo(() => {
    return [...scripts].sort((a, b) => {
      const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
      const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
      if (sortOption === "date-desc") return dateB - dateA;
      if (sortOption === "date-asc") return dateA - dateB;
      if (sortOption === "rating-desc")
        return (b.rating || 0) - (a.rating || 0);
      if (sortOption === "rating-asc") return (a.rating || 0) - (b.rating || 0);
      return 0;
    });
  }, [scripts, sortOption]);

  const totalPages = Math.ceil(sortedScripts.length / perPage);
  const paginated = sortedScripts.slice((page - 1) * perPage, page * perPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] w-full">
        <Spinner className="h-12 w-12 text-primary" variant="ellipsis" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header principal */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guiones</h1>
        <Button
          className="rounded-lg bg-neutral-200 text-black hover:bg-neutral-300"
          onClick={() => setIsNewOpen(true)}
        >
          <Plus size={18} className="mr-2" /> Generar guión
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="destructive"
          size="sm"
          className="rounded-lg"
          onClick={() => setDeleteAll(true)}
          disabled={scripts.length === 0}
        >
          <Trash2 size={16} className="mr-2" />
          Borrar todos
        </Button>

        <Select value={sortOption} onValueChange={setSortOption}>
          <SelectTrigger className="w-40 rounded-lg">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Fecha ↓</SelectItem>
            <SelectItem value="date-asc">Fecha ↑</SelectItem>
            <SelectItem value="rating-desc">Rating ↓</SelectItem>
            <SelectItem value="rating-asc">Rating ↑</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {paginated.length === 0 && (
          <p className="col-span-full text-muted-foreground text-sm text-center">
            No tienes guiones aún.
          </p>
        )}
        {paginated.map((script) => (
          <ScriptCard
            key={script.scriptId}
            script={script}
            onView={() => setSelectedScript(script)}
            onDelete={() => setScriptToDelete(script)}
          />
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="pt-4">
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

      {/* Modales */}
      <ScriptModal
        script={selectedScript}
        onClose={() => setSelectedScript(null)}
        onRating={handleRating}
      />

      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-2xl w-full rounded-xl">
          <ScriptCreatorContainer
            onClose={() => setIsNewOpen(false)}
            onCreated={(newScript: ScriptData) => {
              setScripts((prev) => [{ ...newScript }, ...prev]); // optimista
              setIsNewOpen(false);

              // refresco para traer public/uid_share si el backend los devuelve
              fetchScripts().catch(() =>
                toast.error("Error confirmando guiones, refresca la página")
              );
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar */}
      <ConfirmDeleteDialog
        open={!!scriptToDelete || deleteAll}
        onClose={() => {
          setScriptToDelete(null);
          setDeleteAll(false);
        }}
        onConfirm={handleConfirmDelete}
        deleting={deleting}
        title={deleteAll ? "Eliminar todos los guiones" : "Eliminar guion"}
        description={
          deleteAll
            ? "¿Seguro que quieres eliminar TODOS los guiones? Esta acción no se puede deshacer."
            : "¿Seguro que quieres eliminar este guion? Esta acción no se puede deshacer."
        }
        confirmText={deleteAll ? "Eliminar todos" : "Eliminar"}
      />
    </div>
  );
}
