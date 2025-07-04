"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
} from "firebase/firestore"
import { useEffect, useState } from "react"
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

type Video = {
  firebaseId: string
  titulo: string
  url: string
  estado: number
  createdAt: Timestamp
  userId: string
}

export default function VideoAdminPage() {
  const [videosByEmail, setVideosByEmail] = useState<Record<string, Video[]>>({})
  const [modalOpen, setModalOpen] = useState(false)

  const [email, setEmail] = useState("")
  const [titulo, setTitulo] = useState("")
  const [url, setUrl] = useState("")
  const [estado, setEstado] = useState("0")
  const [loading, setLoading] = useState(false)

  const fetchVideos = async () => {
    const q = collectionGroup(db, "videos")
    const snapshot = await getDocs(q)
    const tempGrouped: Record<string, Video[]> = {}

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Video
      const path = docSnap.ref.path
      const uid = path.split("/")[1]
      const firebaseId = docSnap.id

      const userRef = doc(db, "users", uid)
      const userSnap = await getDoc(userRef)
      const email = userSnap.exists() ? userSnap.data().email || uid : uid

      const videoWithMeta: Video = { ...data, userId: uid, firebaseId }

      if (!tempGrouped[email]) tempGrouped[email] = []
      tempGrouped[email].push(videoWithMeta)
    }

    setVideosByEmail(tempGrouped)
  }

  const handleCreate = async () => {
    if (!email || !titulo || !url) {
      toast.error("Completa todos los campos")
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/get-uid-by-email?email=${email}`)
      const { uid } = await res.json()
      if (!uid) throw new Error("UID no encontrado")

      await addDoc(collection(db, `users/${uid}/videos`), {
        titulo,
        url,
        estado: parseInt(estado),
        createdAt: Timestamp.now(),
      })

      toast.success("Vídeo creado")
      setEmail("")
      setTitulo("")
      setUrl("")
      setEstado("0")
      setModalOpen(false)
      fetchVideos()
    } catch (error) {
      console.error(error)
      toast.error("Error al crear vídeo")
    } finally {
      setLoading(false)
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
      toast.success("Estado actualizado")
      fetchVideos()
    } catch (err) {
      console.error(err)
      toast.error("Error actualizando estado")
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  return (
    <div className="relative">
      <h1 className="text-2xl font-bold mb-6">Vídeos por Usuario</h1>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogTrigger asChild>
          <Button className="absolute top-0 right-0">+ Añadir Vídeo</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Añadir Vídeo</DialogTitle>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Email del usuario</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Título</Label>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div>
              <Label>URL (Frame.io, YouTube...)</Label>
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
            <Button onClick={handleCreate} disabled={loading}>
              {loading ? "Subiendo..." : "Crear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Accordion type="multiple" className="mt-8 space-y-2">
        {Object.entries(videosByEmail).map(([email, videos]) => (
          <AccordionItem key={email} value={email}>
            <AccordionTrigger>{email}</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {videos.map((video, index) => (
                <Card key={index} className="p-4 space-y-2">
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
