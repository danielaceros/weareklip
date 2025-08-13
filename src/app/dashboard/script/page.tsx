"use client";

import { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Star, RefreshCw } from "lucide-react";
import Link from "next/link";

interface ScriptData {
  scriptId: string;
  ctaText: string;
  platform: string;
  addCTA: boolean;
  structure: string;
  tone: string;
  userEmail: string;
  createdAt: { seconds: number; nanoseconds: number };
  duration: string;
  language: string;
  userName: string;
  description: string;
  userPhoto: string;
  script: string;
  rating?: number;
}

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<ScriptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [selectedScript, setSelectedScript] = useState<ScriptData | null>(null);
  const [regenScript, setRegenScript] = useState<ScriptData | null>(null);
  const [sortOption, setSortOption] = useState("date-desc");

  // Escuchar cambios de autenticación
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  // Función para obtener scripts
  const fetchScripts = useCallback(async () => {
    if (!user) return;
    try {
      const scriptsRef = collection(db, "users", user.uid, "guiones");
      const snapshot = await getDocs(scriptsRef);
      const data: ScriptData[] = snapshot.docs.map((docSnap) => {
        const docData = docSnap.data() as Omit<ScriptData, "scriptId">;
        return {
          scriptId: docSnap.id,
          ...docData,
        };
      });
      setScripts(data);
    } catch (error) {
      console.error("Error fetching scripts:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Llamar a fetchScripts cuando cambie el usuario
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
      {/* Botón y orden */}
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
          <Button className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition">
            <Plus size={18} className="mr-2" />
            Crear guion
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedScripts.length === 0 && <p>No tienes guiones aún.</p>}

        {sortedScripts.map((script) => (
          <Card key={script.scriptId} className="overflow-hidden">
            <CardHeader className="p-3 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold truncate">{script.description || "Sin título"}</h3>
                <div className="flex gap-1 mt-1">
                  <Badge variant="outline">{script.platform}</Badge>
                  <Badge variant="outline">{script.duration}</Badge>
                  <Badge variant="outline">{script.structure}</Badge>
                </div>
              </div>
              <Badge>⭐ {script.rating || 0}</Badge>
            </CardHeader>

            <CardContent className="p-3">
              <p className="text-xs text-gray-600 line-clamp-5">
                {script.script || "Sin contenido"}
              </p>
            </CardContent>

            <CardFooter className="p-3 flex justify-between items-center">
              <Button size="sm" variant="secondary" onClick={() => setSelectedScript(script)}>
                Ver
              </Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(script.scriptId)}>
                <Trash2 size={14} />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Modal de vista */}
      <Dialog open={!!selectedScript} onOpenChange={() => setSelectedScript(null)}>
        <DialogContent className="max-w-lg">
          {selectedScript && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedScript.description}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Badge>{selectedScript.platform}</Badge>
                  <Badge>{selectedScript.duration}</Badge>
                  <Badge>{selectedScript.structure}</Badge>
                  <Badge>{selectedScript.tone}</Badge>
                  {selectedScript.addCTA && (
                    <Badge>CTA: {selectedScript.ctaText || "Sí"}</Badge>
                  )}
                </div>

                <p className="whitespace-pre-wrap">{selectedScript.script}</p>

                {/* Rating */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 cursor-pointer ${
                        selectedScript.rating && selectedScript.rating >= star
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-gray-300"
                      }`}
                      onClick={() => handleRating(selectedScript.scriptId, star)}
                    />
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setRegenScript(selectedScript!)}>
                    <RefreshCw size={16} className="mr-1" /> Regenerar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de regeneración */}
    <Dialog open={!!regenScript} onOpenChange={() => setRegenScript(null)}>
    <DialogContent className="max-w-lg">
        {regenScript && (
        <>
            <DialogHeader>
            <DialogTitle>Regenerar guion</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
            {/* Plataforma */}
            <div>
                <label className="block text-sm font-medium mb-1">Plataforma</label>
                <Select
                defaultValue={regenScript.platform}
                onValueChange={(value) =>
                    setRegenScript((prev) => prev && { ...prev, platform: value })
                }
                >
                <SelectTrigger>
                    <SelectValue placeholder="Selecciona plataforma" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                </SelectContent>
                </Select>
            </div>

            {/* Estructura */}
            <div>
                <label className="block text-sm font-medium mb-1">Estructura</label>
                <Select
                defaultValue={regenScript.structure}
                onValueChange={(value) =>
                    setRegenScript((prev) => prev && { ...prev, structure: value })
                }
                >
                <SelectTrigger>
                    <SelectValue placeholder="Selecciona estructura" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="mito-vs-realidad">Mito vs Realidad</SelectItem>
                    <SelectItem value="storytelling">Storytelling</SelectItem>
                    <SelectItem value="problema-solucion">Problema - Solución</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                </SelectContent>
                </Select>
            </div>

            {/* Tono */}
            <div>
                <label className="block text-sm font-medium mb-1">Tono</label>
                <Select
                defaultValue={regenScript.tone}
                onValueChange={(value) =>
                    setRegenScript((prev) => prev && { ...prev, tone: value })
                }
                >
                <SelectTrigger>
                    <SelectValue placeholder="Selecciona tono" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="emocional">Emocional</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                    <SelectItem value="motivacional">Motivacional</SelectItem>
                </SelectContent>
                </Select>
            </div>

            {/* Duración */}
            <div>
                <label className="block text-sm font-medium mb-1">Duración</label>
                <Select
                defaultValue={regenScript.duration}
                onValueChange={(value) =>
                    setRegenScript((prev) => prev && { ...prev, duration: value })
                }
                >
                <SelectTrigger>
                    <SelectValue placeholder="Selecciona duración" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="30-45">30-45 seg</SelectItem>
                    <SelectItem value="45-60">45-60 seg</SelectItem>
                    <SelectItem value="60-90">60-90 seg</SelectItem>
                </SelectContent>
                </Select>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2">
                <input
                type="checkbox"
                checked={regenScript.addCTA || false}
                onChange={(e) =>
                    setRegenScript((prev) => prev && { ...prev, addCTA: e.target.checked })
                }
                />
                <label className="text-sm">Añadir CTA personalizado</label>
            </div>
            {regenScript.addCTA && (
                <input
                type="text"
                className="w-full border rounded p-2 text-sm"
                placeholder="Texto de CTA"
                value={regenScript.ctaText || ""}
                onChange={(e) =>
                    setRegenScript((prev) => prev && { ...prev, ctaText: e.target.value })
                }
                />
            )}

            {/* Botón confirmar */}
            <Button
            className="w-full"
            onClick={async () => {
                if (!regenScript) return;
                try {
                const res = await fetch("/api/chatgpt/scripts/regenerate", {
                    method: "POST",
                    headers: {
                    "Content-Type": "application/json",
                    },
                    body: JSON.stringify(regenScript),
                });

                if (!res.ok) {
                    throw new Error(`Error en regeneración: ${res.statusText}`);
                }

                const data = await res.json();
                console.log("Guion regenerado:", data);

                // Aquí podrías añadir el nuevo guion a tu lista de scripts si lo devuelve la API
                // setScripts(prev => [...prev, data]);

                setRegenScript(null);
                alert("Guion regenerado correctamente");
                } catch (error) {
                console.error(error);
                alert("Hubo un problema al regenerar el guion");
                }
            }}
            >
            Confirmar regeneración
            </Button>

            </div>
        </>
        )}
    </DialogContent>
    </Dialog>

    </>
  );
}
