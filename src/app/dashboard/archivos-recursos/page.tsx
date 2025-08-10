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
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

export default function ArchivosPage() {
  const t = useTranslations("assetsPage");

  const [userId, setUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [filesList, setFilesList] = useState<
    { name: string; url: string; fullPath: string }[]
  >([]);
  const [selectedCategory, setSelectedCategory] = useState("logo");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const CATEGORIES = [
    { key: "logo", label: t("categories.logo"), accept: "image/*", icon: ImageIcon },
    {
      key: "plantilla",
      label: t("categories.plantilla"),
      accept: ".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar,.ai,.psd,.eps",
      icon: FileText,
    },
    {
      key: "audiovisual",
      label: t("categories.audiovisual"),
      accept: "video/*,audio/*",
      icon: VideoIcon,
    },
  ];

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) setUserId(user.uid);
      else setUserId(null);
    });
    return () => unsub();
  }, []);

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
  }, [userId, selectedCategory, uploading]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !userId) return;
    setUploading(true);
    setProgress(0);
    const file = e.target.files[0];
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
        toast.error(t("upload.error", { message: error.message }));
      },
      async () => {
        setUploading(false);
        setProgress(0);
        toast.success(t("upload.success"));
      }
    );
  };

  const handleDelete = async (fullPath: string) => {
    if (!userId) return;
    if (!confirm(t("delete.confirm"))) return;
    try {
      await deleteObject(storageRef(storage, fullPath));
      toast.success(t("delete.success"));
      setFilesList((prev) => prev.filter((f) => f.fullPath !== fullPath));
    } catch (err) {
      console.error("Error al eliminar archivo:", err);
      toast.error(t("delete.error"));
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center bg-background py-10 px-2">
      <div className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-sm p-8 text-foreground">
        <div className="flex items-center gap-2 mb-6">
          <UploadCloud className="text-primary" size={26} />
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
        <p className="mb-6 text-muted-foreground">{t("description")}</p>

        {/* Selector de categoría */}
        <div className="flex gap-3 mb-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.key;
            return (
              <Button
                key={cat.key}
                variant={active ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.key)}
                className={active ? "" : "bg-background"}
              >
                <Icon className="w-4 h-4 mr-1" />
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
            {uploading ? t("upload.uploading") : t("upload.cta")}
          </Button>

          {uploading && (
            <div className="flex items-center gap-2 font-medium text-primary">
              <Loader2 className="animate-spin" size={18} />
              <span>{t("upload.progress", { percent: progress.toFixed(0) })}</span>
            </div>
          )}
        </form>

        {/* Lista de archivos */}
        <div>
          <h2 className="font-semibold mb-2">{t("list.title")}</h2>

          {filesList.length === 0 ? (
            <div className="text-muted-foreground text-sm">{t("list.empty")}</div>
          ) : (
            <ul className="border border-border rounded-lg divide-y divide-border mb-2">
              {filesList.map((file) => (
                <li
                  key={file.fullPath}
                  className="flex items-center justify-between px-4 py-2 bg-muted hover:bg-muted/70"
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
                    title={t("delete.confirm")}
                    onClick={() => handleDelete(file.fullPath)}
                  >
                    <Trash2 className="w-5 h-5 text-destructive" />
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
