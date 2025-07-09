"use client"

import { useEffect, useState, useCallback } from "react"
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore"
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { db, storage } from "@/lib/firebase"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface Props {
  uid: string
}

type Video = {
  id: string
  titulo: string
  url: string
}

export default function ClonacionVideosSection({ uid }: Props) {
  const [videos, setVideos] = useState<Video[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  const fetchVideos = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "users", uid, "clonacion"))
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Video[]
      setVideos(data)
    } catch {
      toast.error("Error al cargar videos")
    }
  }, [uid])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true)
    for (const file of acceptedFiles) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name} excede los 100MB`)
        continue
      }

      const storageRef = ref(storage, `users/${uid}/clonacion/${file.name}`)
      const uploadTask = uploadBytesResumable(storageRef, file)

      toast.info(`Subiendo ${file.name}...`)

      uploadTask.on(
        "state_changed",
        snapshot => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          )
          setUploadProgress(prev => ({ ...prev, [file.name]: progress }))
        },
        () => {
          toast.error(`Error al subir ${file.name}`)
          setUploadProgress(prev => {
            const newState = { ...prev }
            delete newState[file.name]
            return newState
          })
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref)
          const docRef = await addDoc(collection(db, "users", uid, "clonacion"), {
            titulo: file.name,
            url,
            creadoEn: new Date(),
          })
          setVideos(prev => [...prev, { id: docRef.id, titulo: file.name, url }])
          setUploadProgress(prev => {
            const newState = { ...prev }
            delete newState[file.name]
            return newState
          })
          toast.success(`${file.name} subido correctamente`)
        }
      )
    }
    setUploading(false)
  }, [uid])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "video/*": [] },
    maxSize: 100 * 1024 * 1024,
    multiple: true,
    onDrop,
  })

  const handleDelete = async (id: string, url: string) => {
    try {
      const path = decodeURIComponent(
        new URL(url).pathname.split("/o/")[1].split("?")[0]
      )
      await deleteObject(ref(storage, path))
      await deleteDoc(doc(db, "users", uid, "clonacion", id))
      setVideos(prev => prev.filter(v => v.id !== id))
      toast.success("Video eliminado")
    } catch {
      toast.error("Error al eliminar")
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [fetchVideos])

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
            <Card key={video.id} className="p-2 relative group">
              <video
                src={video.url}
                className="rounded aspect-square object-cover w-full cursor-pointer"
                onClick={() => setSelectedUrl(video.url)}
              />
              <Button
                size="sm"
                variant="destructive"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition"
                onClick={() => handleDelete(video.id, video.url)}
              >
                ✕
              </Button>
              <p className="text-xs mt-1 truncate text-center">{video.titulo}</p>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedUrl} onOpenChange={() => setSelectedUrl(null)}>
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
  )
}
