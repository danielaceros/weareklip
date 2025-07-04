"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type Video = {
  firebaseId: string
  titulo: string
  url: string
  estado: number
}

export default function VideosPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [selected, setSelected] = useState<Video | null>(null)
  const [estadoEditado, setEstadoEditado] = useState("0")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid)
        await fetchVideos(user.uid)
      } else {
        toast.error("No autenticado")
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchVideos = async (uid: string) => {
    try {
      const ref = collection(db, "users", uid, "videos")
      const snapshot = await getDocs(ref)

      const data: Video[] = snapshot.docs.map((doc) => {
        const d = doc.data()
        return {
          firebaseId: doc.id,
          titulo: d.titulo ?? "Sin título",
          url: d.url ?? "",
          estado: d.estado ?? 0,
        }
      })

      setVideos(data)
    } catch {
      toast.error("Error cargando vídeos")
    }
  }

  const openEditor = (video: Video) => {
    setSelected(video)
    setEstadoEditado(String(video.estado))
    setOpen(true)
  }

  const guardarCambios = async () => {
    if (!userId || !selected) return

    try {
      const ref = doc(db, "users", userId, "videos", selected.firebaseId)
      await updateDoc(ref, {
        estado: parseInt(estadoEditado),
      })

      setVideos((prev) =>
        prev.map((v) =>
          v.firebaseId === selected.firebaseId
            ? { ...v, estado: parseInt(estadoEditado) }
            : v
        )
      )

      toast.success("Estado actualizado")
      setOpen(false)
    } catch {
      toast.error("Error actualizando")
    }
  }

  const renderEstado = (estado: number) => {
    switch (estado) {
      case 0:
        return <Badge className="bg-red-500">Nuevo</Badge>
      case 1:
        return <Badge className="bg-yellow-400">Cambios</Badge>
      case 2:
        return <Badge className="bg-green-500">Aprobado</Badge>
      default:
        return <Badge variant="secondary">Desconocido</Badge>
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Mis Vídeos</h1>

      {videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card
              key={video.firebaseId}
              className="cursor-pointer hover:shadow-lg transition"
              onClick={() => openEditor(video)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-lg">{video.titulo}</h2>
                  {renderEstado(video.estado)}
                </div>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline text-blue-600"
                >
                  Ver en Frame.io
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No hay vídeos aún.</p>
      )}

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Estado del Vídeo</DialogTitle>
          </DialogHeader>

          <Select value={estadoEditado} onValueChange={setEstadoEditado}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Nuevo</SelectItem>
              <SelectItem value="1">Necesita Cambios</SelectItem>
              <SelectItem value="2">Aprobado</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={guardarCambios}>Guardar cambios</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
