"use client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useDropzone } from "react-dropzone"

type Video = {
  firebaseId: string
  titulo: string
  url: string
}

type Props = {
  video: Video | null
  onClose: () => void
  onChange: (video: Video) => void
  onDelete: (id: string) => void
  onSave: () => void
  onFileSelect: (file: File) => void
  nuevoArchivoVideo: File | null
}

export default function EditarVideoModal({
  video,
  onClose,
  onChange,
  onDelete,
  onSave,
  onFileSelect,
  nuevoArchivoVideo,
}: Props) {
  const { getRootProps, getInputProps } = useDropzone({
    accept: { "video/*": [] },
    maxSize: 100 * 1024 * 1024,
    onDrop: (files) => {
      if (files.length) onFileSelect(files[0])
    },
  })

  return (
    <Dialog open={!!video} onOpenChange={onClose}>
      <DialogContent>
        <h3 className="text-lg font-bold mb-2">Editar Video</h3>
        <Input
          value={video?.titulo || ""}
          onChange={(e) =>
            video && onChange({ ...video, titulo: e.target.value })
          }
        />
        <video
          controls
          src={video?.url}
          className="rounded w-full aspect-[9/16] object-cover my-2"
        />
        <div
          {...getRootProps()}
          className="border border-dashed rounded-md p-4 text-center cursor-pointer"
        >
          <input {...getInputProps()} />
          {nuevoArchivoVideo ? (
            <p className="text-sm">{nuevoArchivoVideo.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sube nueva versión del video (opcional)
            </p>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            variant="destructive"
            onClick={() => video && onDelete(video.firebaseId)}
          >
            Eliminar
          </Button>
          <Button onClick={onSave}>Guardar Cambios</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
