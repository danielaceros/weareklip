"use client"

import { useDropzone } from "react-dropzone"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type Video = {
  firebaseId: string
  titulo: string
  url: string
  estado?: string
}

type Props = {
  videos: Video[]
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
  onUpload: (file: File, title: string) => void
  uploadProgress: number | null
  setArchivoVideo: (file: File | null) => void
  archivoVideo: File | null
  nuevoTitulo: string
  setNuevoTitulo: (value: string) => void
  onSelect: (video: Video) => void
}

export default function VideosSection({
  videos,
  modalOpen,
  setModalOpen,
  onUpload,
  uploadProgress,
  archivoVideo,
  setArchivoVideo,
  nuevoTitulo,
  setNuevoTitulo,
  onSelect,
}: Props) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "video/*": [] },
    maxSize: 100 * 1024 * 1024,
    onDrop: (files) => {
      if (files.length) {
        setArchivoVideo(files[0])
      }
    },
  })

  const handleSubmit = () => {
    if (archivoVideo && nuevoTitulo.trim()) {
      onUpload(archivoVideo, nuevoTitulo.trim())
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">🎬 Videos</h2>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button>+ Crear</Button>
          </DialogTrigger>
          <DialogContent>
            <h3 className="font-semibold text-lg mb-2">Subir video</h3>
            <Input
              placeholder="Título del video"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
            />
            <div
              {...getRootProps()}
              className={`border border-dashed rounded-md p-4 text-center cursor-pointer ${
                isDragActive ? "border-blue-500" : "border-gray-300"
              }`}
            >
              <input {...getInputProps()} />
              {archivoVideo ? (
                <p className="text-sm">{archivoVideo.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Arrastra un video aquí o haz clic para seleccionar uno (máx. 100MB)
                </p>
              )}
            </div>
            <Button onClick={handleSubmit} className="mt-2 w-full" disabled={uploadProgress !== null}>
              {uploadProgress !== null
                ? `Subiendo... ${uploadProgress.toFixed(0)}%`
                : "Subir"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {videos.length === 0 ? (
        <p className="text-muted-foreground">Este cliente no tiene videos aún.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v) => (
            <Card key={v.firebaseId} className="p-3 cursor-pointer" onClick={() => onSelect(v)}>
              <p className="font-semibold text-base">{v.titulo}</p>
              <video controls src={v.url} className="rounded w-full aspect-[9/16] object-cover" />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
