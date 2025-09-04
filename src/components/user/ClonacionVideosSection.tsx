"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trash2, Eye, Upload } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import ConfirmDeleteDialog from "@/components/shared/ConfirmDeleteDialog";
import { Spinner } from "@/components/ui/shadcn-io/spinner"; // 👈 Spinner de shadcn

interface ClonacionVideo {
  id: string;
  url: string;
  thumbnail?: string;
}

interface ClonacionVideosSectionProps {
  t: (key: string) => string;
  clonacionVideos: ClonacionVideo[];
  handleUpload: (file: File) => void;
  handleDelete: (id: string) => Promise<void> | void;
  uploading: boolean;
  progress: number;
  loading?: boolean; // 👈 nuevo prop para spinner inicial
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

  // Estado para confirmación
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <Card className="p-6 shadow-sm bg-card text-card-foreground">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">{t("clonacion.sectionTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("clonacion.sectionSubtitle")}
        </p>
      </div>

      <Separator className="my-4" />

      {/* Layout responsivo */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* IZQUIERDA: Upload */}
        <div className="flex flex-col items-center gap-4 w-full lg:w-auto">
          <label className="flex flex-col items-center justify-center w-full sm:w-40 md:w-48 lg:w-56 border-2 border-dashed border-border rounded-lg p-3 aspect-[9/16] max-h-[100px] cursor-pointer hover:bg-muted/40 transition">
            <Upload className="w-6 h-6 mb-2 text-muted-foreground" />
            <span className="text-xs sm:text-sm font-medium text-center">
              {t("clonacion.uploadPrompt")}
            </span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleUpload(e.target.files[0]);
                }
              }}
              disabled={uploading}
            />
          </label>

          {uploading && (
            <div className="w-full">
              <Progress value={progress} className="w-full" />
              <p className="text-xs mt-1 text-muted-foreground text-center">
                {progress}% {t("clonacion.uploading")}
              </p>
            </div>
          )}
        </div>

        {/* DERECHA: Grid */}
        <div className="flex-1 flex flex-col gap-6 w-full">
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
                    {/* Miniatura */}
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
                      />
                    )}

                    {/* Overlay */}
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

              {/* Paginación */}
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
        </div>
      </div>

      {/* Modal de preview */}
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

      {/* Modal de confirmación de borrado */}
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
    </Card>
  );
}

