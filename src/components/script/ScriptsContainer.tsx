"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { ScriptCard } from "./ScriptCard";
import { ScriptModal } from "./ScriptModal";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import ScriptCreatorContainer from "./ScriptCreatorContainer";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { toast } from "sonner";

interface ScriptData {
  scriptId: string;
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

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  const fetchScripts = useCallback(async () => {
    if (!user) return;
    try {
      const scriptsRef = collection(db, "users", user.uid, "guiones");
      const snapshot = await getDocs(scriptsRef);
      const data: ScriptData[] = snapshot.docs.map((docSnap) => ({
        scriptId: docSnap.id,
        ...(docSnap.data() as Omit<ScriptData, "scriptId">),
      }));
      setScripts(data);
    } catch (error) {
      console.error("Error fetching scripts:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const handleConfirmDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      if (deleteAll) {
        await Promise.all(
          scripts.map((script) =>
            deleteDoc(doc(db, "users", user.uid, "guiones", script.scriptId))
          )
        );
        setScripts([]);
        toast.success("Todos los guiones han sido eliminados");
      } else if (scriptToDelete) {
        await deleteDoc(doc(db, "users", user.uid, "guiones", scriptToDelete.scriptId));
        setScripts((prev) =>
          prev.filter((s) => s.scriptId !== scriptToDelete.scriptId)
        );
        toast.success("Guion eliminado correctamente");
      }
    } catch (err) {
      console.error("Error eliminando guiones:", err);
      toast.error("No se pudieron eliminar los guiones");
    } finally {
      setDeleting(false);
      setScriptToDelete(null);
      setDeleteAll(false);
    }
  };

  const handleRating = async (scriptId: string, newRating: number) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "guiones", scriptId), {
      rating: newRating,
    });
    setScripts((prev) =>
      prev.map((s) =>
        s.scriptId === scriptId ? { ...s, rating: newRating } : s
      )
    );
  };

  const sortedScripts = [...scripts].sort((a, b) => {
    const dateA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
    const dateB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
    if (sortOption === "date-desc") return dateB - dateA;
    if (sortOption === "date-asc") return dateA - dateB;
    if (sortOption === "rating-desc") return (b.rating || 0) - (a.rating || 0);
    if (sortOption === "rating-asc") return (a.rating || 0) - (b.rating || 0);
    return 0;
  });

  const totalPages = Math.ceil(sortedScripts.length / perPage);
  const paginated = sortedScripts.slice((page - 1) * perPage, page * perPage);

  if (loading) return <p className="text-muted-foreground">Cargando guiones...</p>;

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

      {/* Toolbar secundario */}
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
          <ScriptCreatorContainer />
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
