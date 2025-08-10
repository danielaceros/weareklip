"use client";

import { useEffect, useState, useRef } from "react";
import { auth, storage } from "@/lib/firebase";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
  listAll,
  deleteObject,
} from "firebase/storage";
import { Button } from "@/components/ui/button";
import {
  UploadCloud,
  Trash2,
  Loader2,
  FileText,
  ImageIcon,
  VideoIcon,
} from "lucide-react";
//import clsx from "clsx";
import toast from "react-hot-toast";

const CATEGORIES = [
  { key: "logo", label: "Logo", accept: "image/*", icon: ImageIcon },
  {
    key: "plantilla",
    label: "Plantilla de marca",
    accept: ".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,.ai,.psd,.eps",
    icon: FileText,
  },
  {
    key: "audiovisual",
    label: "Material audiovisual",
    accept: "video/*,audio/*",
    icon: VideoIcon,
  },
];

export default function ArchivosPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [filesList, setFilesList] = useState<
    { name: string; url: string; fullPath: string }[]
  >([]);
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].key);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) setUserId(user.uid);
      else setUserId(null);
    });
    return () => unsub();
  }, []);

  // List files for current user/category
  useEffect(() => {
    if (!userId) return;
    const folderRef = storageRef(
      storage,
      `users/${userId}/branding/${selectedCategory}`
    );
    listAll(folderRef)
      .then(async (res) => {
        const files = await Promise.all(
          res.items.map(async (item) => {
            const url = await getDownloadURL(item);
            return { name: item.name, url, fullPath: item.fullPath };
          })
        );
        setFilesList(files);
      })
      .catch(() => setFilesList([]));
  }, [userId, selectedCategory, uploading]); // recarga al subir

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !userId) return;
    setUploading(true);
    setProgress(0);
    const file = e.target.files[0];
    //const ext = file.name.split(".").pop();
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `users/${userId}/branding/${selectedCategory}/${dateStr}_${file.name}`;

    const uploadTask = uploadBytesResumable(storageRef(storage, path), file);
    uploadTask.on(
      "state_changed",
      (snap) => {
        setProgress((snap.bytesTransferred / snap.totalBytes) * 100);
      },
      (error) => {
        setUploading(false);
        toast.error("Error subiendo archivo: " + error.message);
      },
      async () => {
        setUploading(false);
        setProgress(0);
        toast.success("Archivo subido correctamente");
      }
    );
  };

  const handleDelete = async (fullPath: string) => {
    if (!userId) return;
    if (!confirm("¿Seguro que quieres borrar este archivo?")) return;
    try {
      await deleteObject(storageRef(storage, fullPath));
      toast.success("Archivo eliminado");
      setFilesList((prev) => prev.filter((f) => f.fullPath !== fullPath));
    } catch (err) {
      console.error("Error al eliminar archivo:", err);
      toast.error("Error al eliminar archivo");
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center bg-gradient-to-br from-white to-gray-50 py-10 px-2">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lg p-8">
        <div className="flex items-center gap-2 mb-6">
          <UploadCloud className="text-blue-600" size={26} />
          <h1 className="text-2xl font-bold">Archivos y Recursos de Marca</h1>
        </div>
        <p className="mb-6 text-gray-600">
          Sube tus logos, plantillas o material audiovisual. Todos los archivos
          se almacenan de forma segura y solo tú puedes verlos.
        </p>

        {/* Selector de categoría */}
        <div className="flex gap-3 mb-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Button
                key={cat.key}
                variant={selectedCategory === cat.key ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.key)}
                className="flex items-center gap-1 px-3"
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </Button>
            );
          })}
        </div>

        {/* Formulario de subida */}
        <form
          className="flex gap-2 items-center mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            fileInputRef.current?.click();
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={CATEGORIES.find((c) => c.key === selectedCategory)?.accept}
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button type="submit" disabled={uploading}>
            <UploadCloud className="mr-2 w-4 h-4" />
            {uploading ? "Subiendo..." : "Subir archivo"}
          </Button>
          {uploading && (
            <div className="flex items-center gap-1 text-blue-600 font-medium">
              <Loader2 className="animate-spin" size={18} />
              <span>{progress.toFixed(0)}%</span>
            </div>
          )}
        </form>

        {/* Lista de archivos */}
        <div>
          <h2 className="font-semibold mb-2">Archivos subidos:</h2>
          {filesList.length === 0 ? (
            <div className="text-gray-400 text-sm">
              No hay archivos subidos en esta categoría.
            </div>
          ) : (
            <ul className="divide-y border rounded-lg mb-2">
              {filesList.map((file) => (
                <li
                  key={file.fullPath}
                  className="flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100"
                >
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline"
                  >
                    {file.name}
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-2"
                    title="Eliminar"
                    onClick={() => handleDelete(file.fullPath)}
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
