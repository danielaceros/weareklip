// src/components/shared/dropzonecl.tsx
"use client";

import type { Video } from "@/types/video";
import { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { useDropzone, type FileRejection } from "react-dropzone";
import { auth, db, storage } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getAuth } from "firebase/auth";

interface Props {
  uid: string;
}

type ConfirmDelete = { id: string; url: string; title: string };

export default function ClonacionVideosSection({ uid }: Props) {
  const t = useTranslations("userPage.cloning");

  const [videos, setVideos] = useState<Video[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete | null>(null);

  const fetchVideos = useCallback(async () => {
    if (!uid) return;
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Usuario no autenticado");

      const idToken = await currentUser.getIdToken();

      const res = await fetch(`/api/firebase/users/${uid}/clones`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) throw new Error(`Error ${res.status} al cargar vídeos`);

      const docs = await res.json();

      const data: Video[] = docs.map((d: any) => ({
        firebaseId: d.id,
        titulo: d.titulo ?? t("upload.none"),
        url: d.url,
        estado: typeof d.estado === "number" ? d.estado : 0,
        notas: d.notas ?? "",
      }));

      setVideos(data);
    } catch (error) {
      console.error("Error cargando vídeos de clonación:", error);
      handleError(error, t("upload.loadingError"));
    }
  }, [uid, t]);


  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setUploading(true);

      fileRejections.forEach((rejection) => {
        rejection.errors.forEach((error) => {
          if (error.code === "file-too-large") {
            handleError(null, t("upload.maxSize"));
          } else if (error.code === "file-invalid-type") {
            handleError(null, t("upload.onlyVideos"));
          } else {
            handleError(null, t("upload.uploadError", { name: rejection.file.name }));
          }
        });
      });

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setUploading(false);
        toast.error("Debes iniciar sesión");
        return;
      }
      const idToken = await currentUser.getIdToken();

      for (const file of acceptedFiles) {
        const storageRef = ref(storage, `users/${uid}/clonacion/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        const loadingToast = showLoading(
          t("upload.uploadingFile", { name: file.name })
        );

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = Math.round(
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            );
            setUploadProgress((prev) => ({ ...prev, [file.name]: progress }));
          },
          (error) => {
            toast.dismiss(loadingToast);
            handleError(error, t("upload.uploadError", { name: file.name }));
            setUploadProgress((prev) => {
              const next = { ...prev };
              delete next[file.name];
              return next;
            });
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);

              // 👉 Guardamos el doc en Firestore vía backend
              const res = await fetch(`/api/firebase/users/${uid}/clones`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                  titulo: file.name,
                  url,
                  estado: 0,
                  notas: "",
                  creadoEn: new Date(),
                }),
              });

              if (!res.ok) throw new Error("Error guardando clonación");
              const newDoc = await res.json();

              setVideos((prev) => [
                ...prev,
                {
                  firebaseId: newDoc.id,
                  titulo: file.name,
                  url,
                  estado: 0,
                  notas: "",
                },
              ]);

              toast.dismiss(loadingToast);
              showSuccess(t("upload.success", { name: file.name }));
            } catch (error) {
              toast.dismiss(loadingToast);
              handleError(error, t("upload.saveError"));
            } finally {
              setUploadProgress((prev) => {
                const next = { ...prev };
                delete next[file.name];
                return next;
              });
            }
          }
        );
      }

      setUploading(false);
    },
    [uid, t]
  );


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "video/*": [".mp4", ".mov", ".avi", ".mkv"] },
    maxSize: 100 * 1024 * 1024,
    multiple: true,
    onDrop,
  });

  const handleConfirmDelete = async () => {
    if (!confirmDelete || !uid) return;
    const { id } = confirmDelete;
    setDeletingIds((prev) => [...prev, id]);
    const loadingToast = showLoading(t("delete.deleting"));

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("No autenticado");

      // 🔹 Llamar al endpoint DELETE de tu CRUD
      const res = await fetch(`/api/firebase/users/${uid}/clonacion/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }

      // 🔹 Actualizar estado local
      setVideos((prev) => prev.filter((v) => v.firebaseId !== id));

      toast.dismiss(loadingToast);
      showSuccess(t("delete.success"));
    } catch (error) {
      console.error("❌ Error al eliminar clonación:", error);
      toast.dismiss(loadingToast);
      handleError(error, t("delete.error"));
    } finally {
      setDeletingIds((prev) => prev.filter((itemId) => itemId !== id));
      setConfirmDelete(null);
    }
  };



  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return (
    <div className="space-y-4 mt-10">
      <h2 className="text-xl font-semibold">🎭 {t("sectionTitle")}</h2>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-muted/30" : "border-muted"
        }`}
        aria-label={t("dropzone.aria.dropArea")}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-muted-foreground">
          {uploading ? t("upload.loadingVideos") : t("dropzone.placeholder")}
        </p>
      </div>

      {/* Progreso */}
      {Object.entries(uploadProgress).map(([fileName, progress]) => (
        <div key={fileName} className="text-sm text-muted-foreground">
          {fileName} — {progress}%
          <div className="w-full h-2 bg-muted rounded mt-1">
            <div
              className="h-2 bg-primary rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ))}

      {/* Lista de vídeos */}
      {videos.length === 0 ? (
        <p className="text-muted-foreground">{t("upload.none")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {videos.map((video) => (
            <Card key={video.firebaseId} className="p-2 relative group">
              <video
                src={video.url}
                className="rounded aspect-square object-cover w-full cursor-pointer"
                onClick={() => setSelectedUrl(video.url)}
                aria-label={t("grid.aria.openVideo", { title: video.titulo })}
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
                onClick={() =>
                  setConfirmDelete({ id: video.firebaseId, url: video.url, title: video.titulo })
                }
                aria-label={t("grid.aria.deleteVideo", { title: video.titulo })}
                disabled={deletingIds.includes(video.firebaseId)}
              >
                {deletingIds.includes(video.firebaseId) ? t("delete.deleting") : "✕"}
              </Button>
              <p className="text-xs mt-1 truncate text-center">{video.titulo}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmación de borrado */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogTitle>{t("deleteModal.title")}</DialogTitle>
          <p className="py-4">
            {t("deleteModal.body", { title: confirmDelete?.title ?? "" })}
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("deleteModal.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t("deleteModal.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview de vídeo */}
      <Dialog open={!!selectedUrl} onOpenChange={() => setSelectedUrl(null)}>
        <DialogContent className="max-w-3xl w-full">
          <DialogTitle>{t("dialog.videoTitle")}</DialogTitle>
          {selectedUrl && (
            <video
              src={selectedUrl}
              controls
              autoPlay
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
