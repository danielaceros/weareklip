"use client";

import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { LipsyncVideoList } from "./LipsyncVideoList";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import LipsyncCreatePage from "./LipsyncCreatePage"; // 👈 importante

interface VideoData {
  projectId: string;
  title: string;
  status: string;
  downloadUrl?: string;
  duration?: number;
}

export default function LipsyncVideosPage() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isNewOpen, setIsNewOpen] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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

  if (loading) return <p>Cargando vídeos...</p>;

  return (
    <div className="space-y-4">
      {/* Botón Crear */}
      <div className="flex justify-end">
        <Button
          className="rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition"
          onClick={() => setIsNewOpen(true)}
        >
          <Plus size={18} className="mr-2" />
          Crear vídeo
        </Button>
      </div>

      {/* Lista de vídeos */}
      <LipsyncVideoList videos={videos} />

      {/* Modal */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogOverlay className="backdrop-blur-sm fixed inset-0" />
        <DialogContent className="max-w-3xl w-full rounded-xl p-0 overflow-hidden">
          <LipsyncCreatePage />
        </DialogContent>
      </Dialog>
    </div>
  );
}
