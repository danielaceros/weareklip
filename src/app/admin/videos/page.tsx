"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { db } from "@/lib/firebase"
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  Timestamp,
  collection,
  updateDoc,
  deleteDoc,
} from "firebase/firestore"
import { useEffect, useState, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Pencil, Trash } from "lucide-react"

const sendNotificationEmail = async (to: string, subject: string, content: string) => {
  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, content }),
    })
  } catch (err) {
    console.error("Error enviando correo:", err)
  }
}

const getEmailByUid = async (uid: string) => {
  const userSnap = await getDoc(doc(db, "users", uid))
  return userSnap.exists() ? userSnap.data()?.email || uid : uid
}

type Video = {
  firebaseId: string
  titulo: string
  url: string
  estado: number
  createdAt: Timestamp
  userId: string
}

type ClienteActivo = {
  email: string
  uid: string
  planName?: string
  subStatus?: string
}

export default function VideoAdminPage() {
  const [videosByEmail, setVideosByEmail] = useState<Record<string, Video[]>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState<Video | null>(null)

  const [email, setEmail] = useState("")
  const [titulo, setTitulo] = useState("")
  const [url, setUrl] = useState("")
  const [estado, setEstado] = useState("0")
  const [loading, setLoading] = useState(false)
  const [clientesActivos, setClientesActivos] = useState<ClienteActivo[]>([])

  const isActive = (status: string) =>
    ["active", "trialing", "past_due", "unpaid"].includes(status)

  const fetchVideos = async () => {
    try {
      const snapshot = await getDocs(collectionGroup(db, "videos"))
      const tempGrouped: Record<string, Video[]> = {}

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Video
        const uid = docSnap.ref.path.split("/")[1]
        const firebaseId = docSnap.id
        const userSnap = await getDoc(doc(db, "users", uid))

        if (!userSnap.exists()) continue

        const userData = userSnap.data()
        const userEmail = userData?.email || uid
        const videoWithMeta: Video = { ...data, userId: uid, firebaseId }

        if (!tempGrouped[userEmail]) tempGrouped[userEmail] = []
        tempGrouped[userEmail].push(videoWithMeta)
      }

      setVideosByEmail(tempGrouped)
    } catch (err) {
      console.error("Error cargando vídeos:", err)
      toast.error("No se pudieron cargar los vídeos.")
    }
  }

  const fetchActivos = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/clients")
      if (!res.ok) throw new Error("No se pudo acceder a los clientes.")
      const { data } = await res.json()
      const map = new Map<string, ClienteActivo>()
      for (const c of data) {
        if (!map.has(c.email) || isActive(c.subStatus)) {
          map.set(c.email, c)
        }
      }

      setClientesActivos(Array.from(map.values()).filter(c => isActive(c.subStatus!)))
    } catch (err) {
      console.error("Error al cargar clientes activos:", err)
      toast.error("No se pudieron cargar los clientes.")
    }
  }, [])

  useEffect(() => {
    fetchVideos()
    fetchActivos()
  }, [fetchActivos])

  const clienteOptions = clientesActivos.map((c) => ({
    label: `${c.email} (${c.planName ?? "Sin plan"})`,
    value: c.email,
    badge: "Activo",
  }))

  const handleCreateOrUpdate = async () => {
    if (!email || !titulo || !url) {
      toast.warning("Todos los campos son obligatorios.")
      return
    }

    try {
      setLoading(true)
      const userSnap = await getDocs(collection(db, "users"))
      let uid: string | null = null

      userSnap.forEach((doc) => {
        const user = doc.data()
        if (user?.email === email) {
          uid = doc.id
        }
      })

      if (!uid) throw new Error("No se encontró ningún usuario con ese email.")

      const data = {
        titulo,
        url,
        estado: parseInt(estado),
        createdAt: Timestamp.now(),
      }

      if (editingVideo) {
        const ref = doc(db, `users/${editingVideo.userId}/videos/${editingVideo.firebaseId}`)
        await updateDoc(ref, data)
        toast.success("Vídeo actualizado correctamente.")
        const to = await getEmailByUid(editingVideo.userId)
        await sendNotificationEmail(
          to,
          "🎬 Tu vídeo ha sido actualizado",
          `<p>El vídeo <strong>${titulo}</strong> ha sido editado correctamente. Puedes verlo en tu panel.</p>`
        )
      } else {
        await addDoc(collection(db, `users/${uid}/videos`), data)
        toast.success("Vídeo creado correctamente.")
        await sendNotificationEmail(
          email,
          "🎬 Nuevo vídeo disponible",
          `<p>Se ha creado un nuevo vídeo llamado <strong>${titulo}</strong>. Puedes verlo en tu panel.</p>`
        )
      }

      resetForm()
      fetchVideos()
    } catch (err) {
      console.error(err)
      toast.error("Error al guardar el vídeo. Verifica que el email sea válido.")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEmail("")
    setTitulo("")
    setUrl("")
    setEstado("0")
    setEditingVideo(null)
    setModalOpen(false)
  }

  const handleEdit = (video: Video) => {
    setEditingVideo(video)
    setEmail(video.userId)
    setTitulo(video.titulo)
    setUrl(video.url)
    setEstado(video.estado.toString())
    setModalOpen(true)
  }

  const handleDelete = async (video: Video) => {
    try {
      const ref = doc(db, `users/${video.userId}/videos/${video.firebaseId}`)
      await deleteDoc(ref)
      toast.success("Vídeo eliminado correctamente.")
      fetchVideos()
      const to = await getEmailByUid(video.userId)
      await sendNotificationEmail(
        to,
        "🗑️ Tu vídeo ha sido eliminado",
        `<p>El vídeo <strong>${video.titulo}</strong> ha sido eliminado por el equipo de KLIP.</p>`
      )
    } catch (err) {
      console.error(err)
      toast.error("Error al eliminar el vídeo.")
    }
  }

  const handleEstadoChange = async (
    newEstado: string,
    userId: string,
    videoId: string
  ) => {
    try {
      await updateDoc(doc(db, "users", userId, "videos", videoId), {
        estado: parseInt(newEstado),
      })
      toast.success("Estado actualizado.")
      fetchVideos()

      const to = await getEmailByUid(userId)
      const estadoTexto =
        newEstado === "0"
          ? "🆕 Nuevo"
          : newEstado === "1"
          ? "✏️ En revisión"
          : "✅ Aprobado"

      await sendNotificationEmail(
        to,
        `🎯 Tu vídeo ha cambiado de estado: ${estadoTexto}`,
        `<p>El equipo de KLIP ha actualizado el estado de uno de tus vídeos a <strong>${estadoTexto}</strong>.</p>`
      )
    } catch (err) {
      console.error("Error actualizando estado:", err)
      toast.error("No se pudo actualizar el estado del vídeo.")
    }
  }

  return (
    <div className="relative p-6">
      <h1 className="text-2xl font-bold mb-6">📽️ Vídeos por Usuario</h1>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogTrigger asChild>
          <Button className="absolute top-6 right-6">
            + {editingVideo ? "Editar" : "Añadir"} Vídeo
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>{editingVideo ? "✏️ Editar" : "🆕 Añadir"} Vídeo</DialogTitle>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Cliente</Label>
              <Combobox
                options={clienteOptions}
                value={email}
                onValueChange={setEmail}
                placeholder="Selecciona o escribe un email"
                allowCustom
              />
            </div>
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">🆕 Nuevo</SelectItem>
                  <SelectItem value="1">✏️ Cambios</SelectItem>
                  <SelectItem value="2">✅ Aprobado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateOrUpdate} disabled={loading}>
              {loading ? "Guardando..." : editingVideo ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Accordion type="multiple" className="mt-8 space-y-2">
        {Object.entries(videosByEmail).map(([email, videos]) => (
          <AccordionItem key={email} value={email}>
            <AccordionTrigger>{email}</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {videos.map((video) => (
                <Card key={video.firebaseId} className="p-4 space-y-2 relative">
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Button size="icon" variant="ghost" onClick={() => handleEdit(video)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(video)}>
                      <Trash className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                  <p className="font-semibold">{video.titulo}</p>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline text-sm"
                  >
                    Ver vídeo
                  </a>
                  <div>
                    <Label>Estado</Label>
                    <Select
                      value={String(video.estado)}
                      onValueChange={(value) =>
                        handleEstadoChange(value, video.userId, video.firebaseId)
                      }
                    >
                      <SelectTrigger className="w-48 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">🆕 Nuevo</SelectItem>
                        <SelectItem value="1">✏️ Cambios</SelectItem>
                        <SelectItem value="2">✅ Aprobado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
