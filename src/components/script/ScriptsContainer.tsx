"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ScriptCard } from "./ScriptCard";
import { ScriptModal } from "./ScriptModal";

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

  if (loading) return <p>Cargando guiones...</p>;

  return (
    <>
      <div className="flex justify-between mb-4">
        <Select value={sortOption} onValueChange={setSortOption}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Fecha ↓</SelectItem>
            <SelectItem value="date-asc">Fecha ↑</SelectItem>
            <SelectItem value="rating-desc">Rating ↓</SelectItem>
            <SelectItem value="rating-asc">Rating ↑</SelectItem>
          </SelectContent>
        </Select>

        <Link href="/dashboard/script/new">
          <Button>
            <Plus size={18} className="mr-2" /> Crear guion
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedScripts.length === 0 && <p>No tienes guiones aún.</p>}
        {sortedScripts.map((script) => (
          <ScriptCard
            key={script.scriptId}
            script={script}
            onView={() => setSelectedScript(script)}
            onDelete={() => handleDelete(script.scriptId)}
          />
        ))}
      </div>

      <ScriptModal
        script={selectedScript}
        onClose={() => setSelectedScript(null)}
        onRating={handleRating}
      />
    </>
  );
}
