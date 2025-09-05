"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Eye } from "lucide-react";
import Image from "next/image";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { Spinner } from "@/components/ui/shadcn-io/spinner";
import UploadClonacionVideoDialog from "@/components/video/UploadClonacionVideoDialog";
import { toast } from "sonner";

interface ClonacionVideo {
  id: string;
  url: string;
  thumbnail?: string;
  storagePath?: string; // 👈 añadir esto
}

interface ClonacionVideosSectionProps {
  t: (key: string) => string;
  clonacionVideos: ClonacionVideo[];
  handleUpload: (file: File) => Promise<void>;
  handleDelete: (id: string) => Promise<void> | void;
  uploading: boolean;
  progress: number;
  loading?: boolean;
  perPage?: number;
}

export default function ClonacionVideosSection({
  t,
  clonacionVideos,
  handleUpload,
  handleDelete,
  uploading,
  progress,
  loading = false,
  perPage = 6,
}: ClonacionVideosSectionProps) {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload modal
  const [openUpload, setOpenUpload] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isValidAspect, setIsValidAspect] = useState(false);

  const totalPages = Math.ceil(clonacionVideos.length / perPage);
  const paginated = clonacionVideos.slice((page - 1) * perPage, page * perPage);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await handleDelete(deleteTarget);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Validación 9:16
  async function validateAspectRatio(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        const { videoWidth, videoHeight } = video;
        URL.revokeObjectURL(video.src);

        const ratio = videoWidth / videoHeight;
        const expected = 9 / 16;
        const isValid = Math.abs(ratio - expected) < 0.02;

        if (!isValid) {
          toast.error("⚠️ El vídeo debe ser 9:16", {
            description: `Subiste ${videoWidth}x${videoHeight}, debe ser vertical.`,
          });
        } else {
          toast.success("✅ Vídeo válido (9:16)");
        }
        resolve(isValid);
      };

      video.onerror = () => {
        toast.error("❌ No se pudo analizar el vídeo.");
        resolve(false);
      };
    });
  }

  // Cuando se selecciona archivo en modal
  const handleFileSelected = async (file: File) => {
    setPendingFile(file);
    setAnalyzing(true);
    setIsValidAspect(false);

    const ok = await validateAspectRatio(file);
    setIsValidAspect(ok);
    setAnalyzing(false);
  };

  // Confirmar subida
  const confirmUpload = async () => {
    if (!pendingFile || !isValidAspect) return;
    await handleUpload(pendingFile);
    setPendingFile(null);
    setOpenUpload(false);
  };

  return (
    <Card className="p-6 shadow-sm bg-card text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {t("clonacion.sectionTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("clonacion.sectionSubtitle")}
          </p>
        </div>
        <Button onClick={() => setOpenUpload(true)}>
          + Añadir vídeo de clonación
        </Button>
      </div>

      <Separator className="my-4" />

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-60">
          <Spinner size="lg" variant="ellipsis" />
        </div>
      ) : clonacionVideos.length === 0 ? (
        <p className="text-muted-foreground italic">
          {t("clonacion.noVideos")}
        </p>
      ) : (
        <>
          <div
            className="
              grid gap-4
              grid-cols-[repeat(auto-fill,minmax(140px,1fr))]
              sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]
              md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]
            "
          >
            {paginated.map((video, idx) => (
              <div
                key={video.id ?? video.url ?? idx}
                className="relative group rounded-lg overflow-hidden border border-border aspect-[9/16] max-h-[260px]"
              >
                {video.thumbnail ? (
                  <Image
                    src={video.thumbnail}
                    alt="thumbnail"
                    width={200}
                    height={356}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={video.url}
                    className="w-full h-full object-cover"
                    muted
                    onError={(e) => {
                      (e.target as HTMLVideoElement).style.display = "none";
                      toast.error("⚠️ El vídeo ya no está disponible");
                    }}
                  />
                )}

                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setSelectedVideo(video.url)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => setDeleteTarget(video.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <PaginationItem key={i}>
                    <PaginationLink
                      href="#"
                      isActive={page === i + 1}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(i + 1);
                      }}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      {/* Modal preview */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-lg sm:max-w-xl md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("clonacion.previewTitle")}</DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <video
              src={selectedVideo}
              controls
              autoPlay
              className="w-full h-auto rounded-lg max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        deleting={deleting}
        title="Eliminar vídeo"
        description="¿Seguro que quieres eliminar este vídeo? Esta acción no se puede deshacer."
        cancelText="Cancelar"
        confirmText="Eliminar"
      />

      {/* Upload modal */}
      <UploadClonacionVideoDialog
        open={openUpload}
        onOpenChange={setOpenUpload}
        handleUpload={handleFileSelected} // ahora solo analiza
        uploading={uploading}
        progress={progress}
      >
        {/* Preview dentro del modal */}
        {pendingFile && (
          <div className="mt-4 space-y-2">
            {analyzing ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner size="sm" /> Analizando vídeo...
              </div>
            ) : (
              <video
                src={URL.createObjectURL(pendingFile)}
                className="w-full aspect-[9/16] object-cover rounded"
                muted
              />
            )}
            <Button
              onClick={confirmUpload}
              disabled={!isValidAspect || analyzing || uploading}
              className="w-full"
            >
              Confirmar subida
            </Button>
          </div>
        )}
      </UploadClonacionVideoDialog>
    </Card>
  );
}
