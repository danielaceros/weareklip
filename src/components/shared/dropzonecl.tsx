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

interface Props {
  uid: string;
}

export default function ClonacionVideosSection({ uid }: Props) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{id: string, url: string} | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "users", uid, "clonacion"));
      const data = snap.docs.map(doc => {
        const d = doc.data();
        return {
          firebaseId: doc.id,
          titulo: d.titulo ?? "Sin título",
          url: d.url,
          estado: typeof d.estado === "number" ? d.estado : 0,
          notas: d.notas ?? "",
        } as Video;
      });
      setVideos(data);
    } catch (error) {
      handleError(error, "Error al cargar videos");
    }
  }, [uid]);

  const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    setUploading(true);
    
    // Manejar archivos rechazados (como videos demasiado grandes)
    fileRejections.forEach(rejection => {
      rejection.errors.forEach(error => {
        if (error.code === "file-too-large") {
          handleError(null, `${rejection.file.name} excede los 100MB`);
        }
      });
    });
    
    // Procesar archivos aceptados
    for (const file of acceptedFiles) {
      
      const storageRef = ref(storage, `users/${uid}/clonacion/${file.name}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);
      const loadingToast = showLoading(`Subiendo ${file.name}...`);

      uploadTask.on(
        "state_changed",
        snapshot => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }));
        },
        (error) => {
          toast.dismiss(loadingToast);
          handleError(error, `Error al subir ${file.name}`);
          setUploadProgress(prev => {
            const newState = { ...prev };
            delete newState[file.name];
            return newState;
          });
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            const docRef = await addDoc(collection(db, "users", uid, "clonacion"), {
              titulo: file.name,
              url,
              estado: 0,
              notas: "",
              creadoEn: new Date(),
            });
            
            setVideos(prev => [...prev, { 
              firebaseId: docRef.id, 
              titulo: file.name, 
              url, 
              estado: 0, 
              notas: "" 
            }]);
            
            toast.dismiss(loadingToast);
            showSuccess(`${file.name} subido correctamente`);
          } catch (error) {
            toast.dismiss(loadingToast);
            handleError(error, "Error al guardar el video en la base de datos");
          } finally {
            setUploadProgress(prev => {
              const newState = { ...prev };
              delete newState[file.name];
              return newState;
            });
          }
        }
      );
    }
    setUploading(false);
  }, [uid]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "video/*": [".mp4", ".mov", ".avi", ".mkv"] },
    maxSize: 100 * 1024 * 1024, // 100MB
    multiple: true,
    onDrop,
  });

  const handleDeleteClick = (id: string, url: string) => {
    setConfirmDelete({id, url});
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    
    const { id, url } = confirmDelete;
    setDeletingIds(prev => [...prev, id]);
    const loadingToast = showLoading("Eliminando video...");
    
    try {
      const path = decodeURIComponent(
        new URL(url).pathname.split("/o/")[1].split("?")[0]
      );
      await deleteObject(ref(storage, path));
      await deleteDoc(doc(db, "users", uid, "clonacion", id));
      setVideos(prev => prev.filter(v => v.firebaseId !== id));
      toast.dismiss(loadingToast);
      showSuccess("Video eliminado");
    } catch (error) {
      toast.dismiss(loadingToast);
      handleError(error, "Error al eliminar el video");
    } finally {
      setDeletingIds(prev => prev.filter(itemId => itemId !== id));
      setConfirmDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return (
    <div className="space-y-4 mt-10">
      <h2 className="text-xl font-semibold">🎭 Videos de Clonación</h2>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer ${
          isDragActive ? "border-blue-500" : "border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-muted-foreground">
          {uploading
            ? "Subiendo videos..."
            : "Arrastra aquí o haz clic para subir (máx. 100MB c/u)"}
        </p>
      </div>

      {Object.entries(uploadProgress).map(([fileName, progress]) => (
        <div key={fileName} className="text-sm text-muted-foreground">
          {fileName} - {progress}%
          <div className="w-full h-2 bg-gray-200 rounded mt-1">
            <div
              className="h-2 bg-blue-500 rounded"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ))}

      {videos.length === 0 ? (
        <p className="text-muted-foreground">No hay videos aún.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {videos.map(video => (
            <Card key={video.firebaseId} className="p-2 relative group">
              <video
                src={video.url}
                className="rounded aspect-square object-cover w-full cursor-pointer"
                onClick={() => setSelectedUrl(video.url)}
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
                onClick={() => handleDeleteClick(video.firebaseId, video.url)}
                disabled={deletingIds.includes(video.firebaseId)}
              >
                {deletingIds.includes(video.firebaseId) ? "Eliminando..." : "✕"}
              </Button>
              <p className="text-xs mt-1 truncate text-center">{video.titulo}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={!!confirmDelete} onOpenChange={handleCancelDelete}>
        <DialogContent>
          <DialogTitle>Confirmar eliminación</DialogTitle>
          <p className="py-4">¿Estás seguro de que quieres eliminar este video? Esta acción no se puede deshacer.</p>
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleCancelDelete}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para visualizar video */}
      <Dialog open={!!selectedUrl} onOpenChange={() => setSelectedUrl(null)}>
        <DialogTitle className="text-xl font-semibold">Vídeo</DialogTitle>
        <DialogContent className="max-w-3xl w-full">
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