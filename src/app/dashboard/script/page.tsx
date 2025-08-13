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
import { Plus, Trash2, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<ScriptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [selectedScript, setSelectedScript] = useState<ScriptData | null>(null);
  const [sortOption, setSortOption] = useState("date-desc");

  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  const fetchScripts = useCallback(async () => {
    if (!user) return;
    try {
      const scriptsRef = collection(db, "users", user.uid, "guiones");
      const snapshot = await getDocs(scriptsRef);
      const data: ScriptData[] = snapshot.docs.map((docSnap) => {
        const docData = docSnap.data() as Omit<ScriptData, "scriptId">;
        return { scriptId: docSnap.id, ...docData };
      });
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

      {/* Grid de guiones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedScripts.length === 0 && <p>No tienes guiones aún.</p>}
        {sortedScripts.map((script) => (
          <Card key={script.scriptId} className="overflow-hidden">
            <CardHeader className="p-3 flex justify-between items-center">
              <div>
                {script.isAI ? (
                  <>
                    <h3 className="text-sm font-bold truncate">{script.description || "Sin título"}</h3>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline">{script.platform}</Badge>
                      <Badge variant="outline">{script.duration}</Badge>
                      <Badge variant="outline">{script.structure}</Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-bold truncate">{script.videoTitle || "Video replicado"}</h3>
                    <p className="text-xs text-gray-500 truncate">
                      {script.videoChannel} • {script.videoViews?.toLocaleString()} views
                    </p>
                  </>
                )}
              </div>
              {script.isAI && <Badge>⭐ {script.rating || 0}</Badge>}
            </CardHeader>

            <CardContent className="p-3">
              {script.isAI ? (
                <p className="text-xs text-gray-600 line-clamp-5">{script.script || "Sin contenido"}</p>
              ) : (
                <>
                  {script.videoThumbnail && (
                    <Image
                      src={script.videoThumbnail}
                      alt={script.videoTitle || ""}
                      width={400}
                      height={225}
                      className="rounded mb-2"
                    />
                  )}
                  <p className="text-xs text-gray-600 line-clamp-5">{script.script || "Sin contenido"}</p>
                </>
              )}
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
                <DialogTitle>
                  {selectedScript.isAI ? selectedScript.description : selectedScript.videoTitle}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {selectedScript.isAI ? (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      <Badge>{selectedScript.platform}</Badge>
                      <Badge>{selectedScript.duration}</Badge>
                      <Badge>{selectedScript.structure}</Badge>
                      <Badge>{selectedScript.tone}</Badge>
                      {selectedScript.addCTA && <Badge>CTA: {selectedScript.ctaText || "Sí"}</Badge>}
                    </div>
                    <p className="whitespace-pre-wrap">{selectedScript.script}</p>
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
                  </>
                ) : (
                  <>
                    {selectedScript.videoThumbnail && (
                      <Image
                        src={selectedScript.videoThumbnail}
                        alt={selectedScript.videoTitle || ""}
                        width={800}
                        height={450}
                        className="rounded w-full"
                      />
                    )}
                    <p className="text-sm text-gray-500">
                      Canal: {selectedScript.videoChannel} <br />
                      Publicado: {selectedScript.videoPublishedAt} <br />
                      Views: {selectedScript.videoViews?.toLocaleString()}
                    </p>
                    <p className="whitespace-pre-wrap">{selectedScript.script}</p>
                    <a
                      href={selectedScript.fuente}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline text-sm"
                    >
                      Ver video original
                    </a>
                  </>
                )}

                {selectedScript.script && (
                  <Link href={`/dashboard/audio/new?text=${encodeURIComponent(selectedScript.script)}`}>
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                      Clonar texto con voz
                    </Button>
                  </Link>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
