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
import { db, storage } from "@/lib/firebase";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { handleError, showSuccess, showLoading } from "@/lib/errors";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface Props {
  uid: string;
}

type ConfirmDelete = { id: string; url: string; title: string };

export default function ClonacionVideosSection({ uid }: Props) {
  const t = useTranslations("userPage.cloning");

  const [videos, setVideos] = useState<Video[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDelete | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "users", uid, "clonacion"));
      const data = snap.docs.map((d) => {
        const docData = d.data();
        return {
          firebaseId: d.id,
          titulo: docData.titulo ?? t("upload.none"),
          url: docData.url,
          estado: typeof docData.estado === "number" ? docData.estado : 0,
          notas: docData.notas ?? "",
        } as Video;
      });
      setVideos(data);
    } catch (error) {
      handleError(error, t("upload.loadingError")); // 🔸 nueva clave
    }
  }, [uid, t]);

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setUploading(true);

      // Rechazos (tamaño/tipo)
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

      // Aceptados
      for (const file of acceptedFiles) {
        const storageRef = ref(storage, `users/${uid}/clonacion/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        const loadingToast = showLoading(t("upload.uploadingFile", { name: file.name }));

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
              const docRef = await addDoc(
                collection(db, "users", uid, "clonacion"),
                {
                  titulo: file.name,
                  url,
                  estado: 0,
                  notas: "",
                  creadoEn: new Date(),
                }
              );

              setVideos((prev) => [
                ...prev,
                {
                  firebaseId: docRef.id,
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

  const handleDeleteClick = (id: string, url: string, title: string) => {
    setConfirmDelete({ id, url, title });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;

    const { id, url } = confirmDelete;
    setDeletingIds((prev) => [...prev, id]);
    const loadingToast = showLoading(t("delete.deleting"));

    try {
      const path = decodeURIComponent(
        new URL(url).pathname.split("/o/")[1].split("?")[0]
      );
      await deleteObject(ref(storage, path));
      await deleteDoc(doc(db, "users", uid, "clonacion", id));
      setVideos((prev) => prev.filter((v) => v.firebaseId !== id));
      toast.dismiss(loadingToast);
      showSuccess(t("delete.success"));
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, t("delete.error"));
    } finally {
      setDeletingIds((prev) => prev.filter((itemId) => itemId !== id));
      setConfirmDelete(null);
    }
  };

  const handleCancelDelete = () => setConfirmDelete(null);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return (
    <div className="space-y-4 mt-10">
      <h2 className="text-xl font-semibold">🎭 {t("sectionTitle")}</h2>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer ${
          isDragActive ? "border-blue-500" : "border-gray-300"
        }`}
        aria-label={t("dropzone.aria.dropArea")}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-muted-foreground">
          {uploading ? t("upload.loadingVideos") : t("dropzone.placeholder")}
        </p>
      </div>

      {Object.entries(uploadProgress).map(([fileName, progress]) => (
        <div key={fileName} className="text-sm text-muted-foreground">
          {fileName} — {progress}%
          <div className="w-full h-2 bg-gray-200 rounded mt-1">
            <div
              className="h-2 bg-blue-500 rounded"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ))}

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
                aria-label={t("grid.aria.closeVideo")}
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
                onClick={() =>
                  handleDeleteClick(video.firebaseId, video.url, video.titulo)
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
      <Dialog open={!!confirmDelete} onOpenChange={handleCancelDelete}>
        <DialogContent>
          <DialogTitle>{t("deleteModal.title")}</DialogTitle>
          <p className="py-4">
            {t("deleteModal.body", { title: confirmDelete?.title ?? "" })}
          </p>
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleCancelDelete}>
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
        <DialogTitle className="text-xl font-semibold">
          {t("dialog.videoTitle")} {/* 🔸 nueva clave */}
        </DialogTitle>
        <DialogContent className="max-w-3xl w-full">
          {selectedUrl && (
            <video src={selectedUrl} controls autoPlay className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
