"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
  deleteObject,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import clsx from "clsx";
import { getAuth } from "firebase/auth";

interface ClonacionVideo {
  id: string;
  titulo: string;
  url: string;
  storagePath: string;
}

interface Props {
  userId: string;
}

export default function ClonacionVideos({ userId }: Props) {
  const [clonacionVideos, setClonacionVideos] = useState<ClonacionVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ClonacionVideo | null>(null);
  const [editTitles, setEditTitles] = useState<Record<string, string>>({});
  const [videoToDelete, setVideoToDelete] = useState<ClonacionVideo | null>(null);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const dragDropRef = useRef<HTMLDivElement | null>(null);

  const loadClonacionVideos = useCallback(async () => {
    if (!userId) return
    setLoadingVideos(true)
    try {
      const auth = getAuth()
      const currentUser = auth.currentUser
      if (!currentUser) return

      const idToken = await currentUser.getIdToken()

      const res = await fetch(`/api/firebase/users/${userId}/clones`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })

      if (!res.ok) throw new Error(`Error ${res.status}`)

      const docs: any[] = await res.json()
      const videos: ClonacionVideo[] = docs.map((d) => ({
        id: d.id,
        titulo: d.titulo ?? "Sin título",
        url: d.url,
        storagePath: d.storagePath,
      }))

      setClonacionVideos(videos)
      setEditTitles(videos.reduce((acc, v) => ({ ...acc, [v.id]: v.titulo }), {}))
    } catch (error) {
      console.error("Error cargando videos clonacion:", error)
      toast.error("Error cargando videos de clonación.")
    } finally {
      setLoadingVideos(false)
    }
  }, [userId])


  useEffect(() => {
    if (userId) {
      loadClonacionVideos();
    }
  }, [loadClonacionVideos, userId]);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!userId) {
      toast.error("Usuario no autenticado");
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("video/")) {
        toast.error("Solo archivos de vídeo permitidos.");
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error("El vídeo debe ser menor a 100MB.");
        return;
      }
    }

    Array.from(files).forEach((file) => {
      const randomId = Math.random().toString(36).substring(2, 10);
      const ext = file.name.split(".").pop() ?? "mp4";
      const title = `${userId}_${randomId}`;
      uploadVideo(file, title, ext);
    });
  };

  const uploadVideo = (file: File, title: string, ext: string) => {
    if (!userId) return;
    setUploadingVideo(true);
    setVideoUploadProgress(0);

    const videoPath = `users/${userId}/clones/${title}.${ext}`;
    const videoRef = storageRef(storage, videoPath);

    const uploadTask = uploadBytesResumable(videoRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const prog = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setVideoUploadProgress(prog);
      },
      (error) => {
        console.error("Error subiendo video:", error);
        toast.error("Error subiendo video.");
        setUploadingVideo(false);
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);

          // 🔹 ahora guardamos en nuestro endpoint seguro
          const auth = getAuth();
          const currentUser = auth.currentUser;
          if (!currentUser) throw new Error("No user logged in");

          const idToken = await currentUser.getIdToken();

          const res = await fetch(`/api/firebase/users/${userId}/clones`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              titulo: title,
              url,
              storagePath: videoPath,
            }),
          });

          if (!res.ok) throw new Error(`Error creando metadata: ${res.status}`);
          const saved = await res.json();

          // 🔹 actualizamos el estado local con la respuesta del backend
          setClonacionVideos((prev) => [
            { id: saved.id, titulo: title, url, storagePath: videoPath },
            ...prev,
          ]);
          setEditTitles((prev) => ({ ...prev, [saved.id]: title }));

          toast.success("Vídeo subido correctamente.");
        } catch (e) {
          console.error(e);
          toast.error("Error guardando video en base de datos.");
        }
        setUploadingVideo(false);
        setVideoUploadProgress(0);
      }
    );
  };


  const confirmDeleteVideo = (video: ClonacionVideo) => {
    setVideoToDelete(video);
  };

  const cancelDelete = () => {
    setVideoToDelete(null);
  };

  const handleDeleteVideo = async () => {
    if (!userId || !videoToDelete) {
      toast.error("Usuario no autenticado o vídeo no seleccionado");
      setVideoToDelete(null);
      return;
    }

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Not authenticated");

      const res = await fetch(
        `/api/firebase/users/${userId}/clones/${videoToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      // Actualizar estado local
      setClonacionVideos((prev) =>
        prev.filter((v) => v.id !== videoToDelete.id)
      );
      toast.success("Vídeo eliminado correctamente.");

      if (selectedVideo?.id === videoToDelete.id) {
        setSelectedVideo(null);
      }
    } catch (e) {
      console.error("❌ Error eliminando vídeo:", e);
      toast.error("Error eliminando vídeo.");
    } finally {
      setVideoToDelete(null);
    }
  };


  return (
    <>
      {/* Drag & drop area + upload */}
      <div
        ref={dragDropRef}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => videoInputRef.current?.click()}
        className={clsx(
          "border-2 border-dashed rounded p-8 text-center cursor-pointer select-none",
          dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
        )}
        aria-label="Área de arrastrar y soltar vídeos para subir"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") videoInputRef.current?.click();
        }}
      >
        {uploadingVideo ? (
          <p>Subiendo vídeo... {videoUploadProgress.toFixed(0)}%</p>
        ) : (
          <p>Arrastra y suelta aquí tus vídeos o haz clic para seleccionaeeeeeeer</p>
        )}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = e.target.files;
            if (!files) return;
            if (!userId) {
              toast.error("Usuario no autenticado");
              return;
            }
            Array.from(files).forEach((file) => {
              if (!file.type.startsWith("video/")) {
                toast.error("Solo archivos de vídeo permitidos.");
                return;
              }
              if (file.size > 100 * 1024 * 1024) {
                toast.error("El vídeo debe ser menor a 100MB.");
                return;
              }
              const randomId = Math.random().toString(36).substring(2, 10);
              const ext = file.name.split(".").pop() ?? "mp4";
              const title = `${userId}_${randomId}`;
              uploadVideo(file, title, ext);
            });
            e.target.value = "";
          }}
        />
      </div>

      {/* Vídeos list */}
      <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {loadingVideos ? (
          <p>Cargando vídeos...</p>
        ) : clonacionVideos.length === 0 ? (
          <p>No tienes vídeos subidos.</p>
        ) : (
          clonacionVideos.map((video) => (
            <div
              key={video.id}
              className="relative cursor-pointer rounded border overflow-hidden shadow hover:shadow-lg"
              style={{ aspectRatio: "1 / 1" }}
            >
              <video
                src={video.url}
                muted
                preload="metadata"
                onClick={() => setSelectedVideo(video)}
                className="w-full h-full object-cover rounded"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedVideo(video);
                }}
              />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDeleteVideo(video);
                }}
                className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition"
                aria-label={`Eliminar video ${video.titulo}`}
              >
                ×
              </button>

              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate select-none">
                {editTitles[video.id] ?? video.titulo}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {videoToDelete && (
        <DeleteConfirmModal
          titulo={videoToDelete.titulo}
          onCancel={cancelDelete}
          onConfirm={handleDeleteVideo}
        />
      )}

      {selectedVideo && (
        <VideoPreviewModal
          titulo={editTitles[selectedVideo.id] ?? selectedVideo.titulo}
          url={selectedVideo.url}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </>
  );
}

function DeleteConfirmModal({
  titulo,
  onCancel,
  onConfirm,
}: {
  titulo: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
    >
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
        <h3 id="modal-title" className="text-lg font-semibold mb-4">
          Confirmar eliminación
        </h3>
        <p id="modal-desc" className="mb-6">
          ¿Seguro que quieres eliminar el vídeo <strong>{titulo}</strong>?
        </p>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}

function VideoPreviewModal({
  titulo,
  url,
  onClose,
}: {
  titulo: string;
  url: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="self-end mb-2 text-white text-3xl font-bold focus:outline-none"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Cerrar video"
      >
        ×
      </button>
      <video
        src={url}
        controls
        autoPlay
        className="max-w-full max-h-[80vh] rounded"
      />
      <p className="text-white mt-2 truncate">{titulo}</p>
    </div>
  );
}

