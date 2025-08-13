"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus } from "lucide-react";

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  duration?: number;
  completedAt?: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Escuchar cambios de usuario
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Cargar vídeos desde la colección lipsync
  useEffect(() => {
    const fetchVideos = async () => {
      if (!user) return;

      try {
        const videosRef = collection(db, "users", user.uid, "lipsync");
        const snapshot = await getDocs(videosRef);

        const data: VideoData[] = snapshot.docs.map((docSnap) => ({
          projectId: docSnap.id,
          ...(docSnap.data() as Omit<VideoData, "projectId">),
        }));
        setVideos(data);
      } catch (error) {
        console.error("Error fetching lipsync videos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600">Completado</Badge>;
      case "processing":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Procesando</Badge>;
      case "error":
        return <Badge className="bg-red-500 hover:bg-red-600">Error</Badge>;
      default:
        return <Badge className="bg-gray-500">Desconocido</Badge>;
    }
  };

  if (loading) return <p>Cargando vídeos...</p>;

  return (
    <div className="space-y-4">
      {/* Botón crear vídeo */}
      <div className="flex justify-end">
        <Link href="/dashboard/video/new">
          <Button className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition">
            <Plus size={18} className="mr-2" />
            Crear vídeo
          </Button>
        </Link>
      </div>

      {/* Lista de vídeos */}
      {videos.length === 0 ? (
        <p>No tienes vídeos aún.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {videos.map((video) => (
            <Card key={video.projectId} className="overflow-hidden">
              <CardHeader className="p-3">
                <h3 className="text-sm font-bold truncate">
                  {video.title || "Sin título"}
                </h3>
                <div>{getStatusBadge(video.status)}</div>
              </CardHeader>

              <CardContent className="p-0">
                {video.downloadUrl && video.status === "completed" ? (
                  <video
                    controls
                    src={video.downloadUrl}
                    className="w-full aspect-[9/16] object-cover"
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400 text-xs p-4">
                    En proceso...
                  </div>
                )}
              </CardContent>

              <CardFooter className="p-3 flex justify-between items-center gap-2">
                {video.downloadUrl && (
                  <>
                    <Button size="sm" variant="secondary" asChild>
                      <a
                        href={video.downloadUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Descargar
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        window.location.href = `/dashboard/edit/new?videoUrl=${encodeURIComponent(video.downloadUrl!)}`;
                      }}
                    >
                      Autoeditar
                    </Button>
                  </>
                )}
                {video.duration && (
                  <span className="text-xs text-gray-500">
                    ⏱ {video.duration}s
                  </span>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
