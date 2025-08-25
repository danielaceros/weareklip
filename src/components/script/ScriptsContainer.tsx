"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
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
  const [sortOption, setSortOption] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [isNewOpen, setIsNewOpen] = useState(false);

  const perPage = 8; // 2 filas × 2 columnas

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

  const handleDelete = async (scriptId: string) => {
    if (!user) return;
    if (!confirm("¿Eliminar este guion?")) return;
    await deleteDoc(doc(db, "users", user.uid, "guiones", scriptId));
    setScripts((prev) => prev.filter((s) => s.scriptId !== scriptId));
  };

  const handleRating = async (scriptId: string, newRating: number) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "guiones", scriptId), { rating: newRating });
    setScripts((prev) =>
      prev.map((s) => (s.scriptId === scriptId ? { ...s, rating: newRating } : s))
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

  // Paginación
  const totalPages = Math.ceil(sortedScripts.length / perPage);
  const paginated = sortedScripts.slice((page - 1) * perPage, page * perPage);

  if (loading) return <p className="text-muted-foreground">Cargando guiones...</p>;

  return (
    <div className="flex flex-col space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Guiones</h1>
        <div className="flex items-center gap-4">
          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Fecha ↓</SelectItem>
              <SelectItem value="date-asc">Fecha ↑</SelectItem>
              <SelectItem value="rating-desc">Rating ↓</SelectItem>
              <SelectItem value="rating-asc">Rating ↑</SelectItem>
            </SelectContent>
          </Select>
          <Button className="rounded-lg" onClick={() => setIsNewOpen(true)}>
            <Plus size={18} className="mr-2" /> Crear guion
          </Button>
        </div>
      </div>

      {/* Grid dinámico */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(400px,1fr))]">
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
              onDelete={() => handleDelete(script.scriptId)}
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
    </div>
  );
}
