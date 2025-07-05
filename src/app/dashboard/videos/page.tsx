"use client"

import { useEffect, useState, useCallback } from "react"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection,
  getDocs,
  doc,
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
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Video | null>(null)
  const [estadoEditado, setEstadoEditado] = useState("0")
  const [open, setOpen] = useState(false)

  const fetchVideos = useCallback(async (uid: string) => {
    setLoading(true)
    try {
      const ref = collection(db, "users", uid, "videos")
      const snapshot = await getDocs(ref)

      if (snapshot.empty) {
        toast("Aún no tienes vídeos", {
          description: "Cuando estén listos, los verás aquí.",
        })
      }

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
    } catch (error) {
      console.error("Error obteniendo vídeos:", error)
      toast.error("Error al cargar los vídeos", {
        description: "Verifica tu conexión o intenta de nuevo.",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        toast.error("No autenticado", {
          description: "Inicia sesión para acceder a tus vídeos.",
        })
        setLoading(false)
        return
      }

      setUserId(user.uid)
      await fetchVideos(user.uid)
    })

    return () => unsubscribe()
  }, [fetchVideos])

  const openEditor = (video: Video) => {
    setSelected(video)
    setEstadoEditado(String(video.estado))
    setOpen(true)
  }

  const guardarCambios = async () => {
    if (!userId || !selected) {
      toast.error("No se puede guardar", {
        description: "Falta información del usuario o vídeo.",
      })
      return
    }

    try {
      const ref = doc(db, "users", userId, "videos", selected.firebaseId)
      await updateDoc(ref, { estado: parseInt(estadoEditado) })

      setVideos((prev) =>
        prev.map((v) =>
          v.firebaseId === selected.firebaseId
            ? { ...v, estado: parseInt(estadoEditado) }
            : v
        )
      )

      toast.success("Estado actualizado correctamente")
      setOpen(false)
    } catch (error) {
      console.error("Error guardando cambios:", error)
      toast.error("No se pudo actualizar el estado del vídeo")
    }
  }

  const renderEstado = (estado: number) => {
    switch (estado) {
      case 0:
        return <Badge className="bg-red-500 text-white">🆕 Nuevo</Badge>
      case 1:
        return <Badge className="bg-yellow-400 text-black">✏️ Cambios</Badge>
      case 2:
        return <Badge className="bg-green-500 text-white">✅ Aprobado</Badge>
      default:
        return <Badge variant="secondary">Desconocido</Badge>
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Mis Vídeos</h1>

      {loading ? (
        <p className="text-muted-foreground animate-pulse">Cargando vídeos...</p>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {videos.map((video) => (
            <Card
              key={video.firebaseId}
              className="cursor-pointer hover:shadow-lg transition"
              onClick={() => openEditor(video)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-lg truncate">{video.titulo}</h2>
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
        <p className="text-muted-foreground">No hay vídeos disponibles.</p>
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
              <SelectItem value="0">🆕 Nuevo</SelectItem>
              <SelectItem value="1">✏️ Cambios</SelectItem>
              <SelectItem value="2">✅ Aprobado</SelectItem>
            </SelectContent>
          </Select>

          <Button className="mt-4" onClick={guardarCambios}>
            Guardar cambios
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
