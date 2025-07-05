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
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
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
import { useEffect, useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Pencil, Trash } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

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
  const [estado, setEstado] = useState("0")

  const [loading, setLoading] = useState(false)
  const [clientesActivos, setClientesActivos] = useState<ClienteActivo[]>([])

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileUrl, setFileUrl] = useState("") // URL video subido

  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const selectedFile = e.target.files[0]

    if (!email) {
      toast.error("Selecciona un cliente antes de subir un archivo.")
      e.target.value = "" // reset input
      return
    }

    // Validación tipo .mp4
    if (selectedFile.type !== "video/mp4") {
      toast.error("Solo se permiten archivos .mp4")
      e.target.value = "" // reset input
      return
    }

    // Validación tamaño max 100MB
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("El archivo no puede superar los 100 MB")
      e.target.value = "" // reset input
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)

      // Obtener uid del email seleccionado
      const userSnap = await getDocs(collection(db, "users"))
      let uid: string | null = null
      userSnap.forEach((doc) => {
        const user = doc.data()
        if (user?.email === email) {
          uid = doc.id
        }
      })
      if (!uid) throw new Error("No se encontró usuario para subir video.")

      // Generar id para el archivo en storage
      const videoId = editingVideo ? editingVideo.firebaseId : uuidv4()

      const storage = getStorage()
      const fileRef = storageRef(storage, `users/${uid}/videos/${videoId}.mp4`)

      const uploadTask = uploadBytesResumable(fileRef, selectedFile)

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          console.error("Error subiendo archivo:", error)
          toast.error("Error subiendo archivo.")
          setUploading(false)
          setUploadProgress(0)
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setFileUrl(downloadURL)
          toast.success("Archivo subido correctamente.")
          setUploading(false)
          setUploadProgress(100)
        }
      )
    } catch (err) {
      console.error(err)
      toast.error("Error durante la subida del archivo.")
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleCreateOrUpdate = async () => {
    if (!email || !titulo || !fileUrl) {
      toast.warning("Todos los campos son obligatorios, incluyendo el archivo subido.")
      return
    }

    try {
      setLoading(true)

      // Obtener uid del email
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
        url: fileUrl,
        estado: parseInt(estado),
        createdAt: editingVideo ? editingVideo.createdAt : Timestamp.now(),
      }

      if (editingVideo) {
        const ref = doc(db, `users/${uid}/videos/${editingVideo.firebaseId}`)
        await updateDoc(ref, data)
        toast.success("Vídeo actualizado correctamente.")
        const to = await getEmailByUid(uid)
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
    setEstado("0")
    setFileUrl("")
    setUploading(false)
    setUploadProgress(0)
    setEditingVideo(null)
    setModalOpen(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleEdit = (video: Video) => {
    setEditingVideo(video)
    setEmail(video.userId)
    setTitulo(video.titulo)
    setEstado(video.estado.toString())
    setFileUrl(video.url)
    setModalOpen(true)
    if (fileInputRef.current) fileInputRef.current.value = ""
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
              <input
                type="text"
                className="w-full rounded border px-3 py-2 text-sm"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div>
              <Label>Archivo de vídeo (drag & drop o click, solo .mp4 hasta 100MB)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp4"
                onChange={handleFileChange}
                disabled={uploading}
                className="block w-full rounded border border-dashed border-gray-400 p-8 text-center cursor-pointer hover:border-blue-500"
              />
              {uploading && (
                <p className="text-sm mt-2 text-muted-foreground">
                  Subiendo archivo... {uploadProgress.toFixed(0)}%
                </p>
              )}
              {!uploading && fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline text-sm mt-1 block"
                >
                  Ver vídeo subido
                </a>
              )}
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
            <Button onClick={handleCreateOrUpdate} disabled={loading || uploading}>
              {loading || uploading ? "Guardando..." : editingVideo ? "Actualizar" : "Crear"}
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
