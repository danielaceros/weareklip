"use client"

import { useCallback } from "react"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore"
import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useDropzone } from "react-dropzone"

// Tipos

type Cliente = {
  email: string
  name?: string
  stripeId?: string
  stripeLink?: string
}

type Guion = {
  firebaseId: string
  titulo: string
  contenido: string
  estado: number
}

type Video = {
  firebaseId: string
  titulo: string
  url: string
  estado?: string
}

export default function ClientProfilePage() {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [guiones, setGuiones] = useState<Guion[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const [modalGuionOpen, setModalGuionOpen] = useState(false)
  const [modalVideoOpen, setModalVideoOpen] = useState(false)

  const [nuevoGuion, setNuevoGuion] = useState({ titulo: "", contenido: "" })
  const [nuevoVideoTitulo, setNuevoVideoTitulo] = useState("")
  const [archivoVideo, setArchivoVideo] = useState<File | null>(null)

  const [guionSeleccionado, setGuionSeleccionado] = useState<Guion | null>(null)
  const [videoSeleccionado, setVideoSeleccionado] = useState<Video | null>(null)
  const [nuevoArchivoVideo, setNuevoArchivoVideo] = useState<File | null>(null)

  const rawParams = useParams()
  const uid = Array.isArray(rawParams.uid) ? rawParams.uid[0] : rawParams.uid

  const fetchData = useCallback(async () => {
  if (!uid) return toast.error("UID inválido.")
  try {
    const userDocRef = doc(db, "users", uid)
    const userSnap = await getDoc(userDocRef)
    if (!userSnap.exists()) throw new Error("Cliente no encontrado.")
    const userData = userSnap.data() as Cliente
    setCliente(userData)

    const guionesSnap = await getDocs(collection(userDocRef, "guiones"))
    const guionesData = guionesSnap.docs.map(doc => ({
      firebaseId: doc.id,
      ...doc.data()
    })) as Guion[]
    setGuiones(guionesData)

    const videosSnap = await getDocs(collection(userDocRef, "videos"))
    const videosData = videosSnap.docs.map(doc => ({
      firebaseId: doc.id,
      ...doc.data()
    })) as Video[]
    setVideos(videosData)
  } catch (err) {
    console.error(err)
    toast.error("Error al cargar la ficha del cliente.")
  } finally {
    setLoading(false)
  }
}, [uid])

  const handleCreateGuion = async () => {
    if (!uid || typeof uid !== "string") return toast.error("UID inválido.")
    const { titulo, contenido } = nuevoGuion
    if (!titulo.trim() || !contenido.trim()) return toast.error("Completa todos los campos.")
    try {
      const refCol = collection(db, "users", uid, "guiones")
      await addDoc(refCol, {
        titulo,
        contenido,
        estado: 0,
        creadoEn: new Date()
      })
      setNuevoGuion({ titulo: "", contenido: "" })
      setModalGuionOpen(false)
      toast.success("Guion creado.")
      fetchData()
    } catch (err) {
      console.error("Error al crear guion:", err)
      toast.error("Error al crear guion.")
    }
  }

  const handleUpdateGuion = async () => {
    if (!uid || !guionSeleccionado) return
    try {
      const ref = doc(db, "users", uid, "guiones", guionSeleccionado.firebaseId)
      await updateDoc(ref, {
        titulo: guionSeleccionado.titulo,
        contenido: guionSeleccionado.contenido,
      })
      toast.success("Guion actualizado")
      setGuionSeleccionado(null)
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error("Error al actualizar guion")
    }
  }

  const handleUpdateVideo = async () => {
    if (!uid || !videoSeleccionado) return
    try {
      let newURL = videoSeleccionado.url
      if (nuevoArchivoVideo) {
        const storageRef = ref(storage, `users/${uid}/videos/${nuevoArchivoVideo.name}`)
        const uploadTask = await uploadBytesResumable(storageRef, nuevoArchivoVideo)
        newURL = await getDownloadURL(uploadTask.ref)
      }
      const refDoc = doc(db, "users", uid, "videos", videoSeleccionado.firebaseId)
      await updateDoc(refDoc, {
        titulo: videoSeleccionado.titulo,
        url: newURL,
      })
      toast.success("Video actualizado")
      setVideoSeleccionado(null)
      setNuevoArchivoVideo(null)
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error("Error al actualizar video")
    }
  }

  const handleUploadVideo = async () => {
    if (!uid || !archivoVideo || !nuevoVideoTitulo.trim()) {
      toast.error("Completa todos los campos y sube un archivo.")
      return
    }
    if (archivoVideo.size > 100 * 1024 * 1024) {
      toast.error("El archivo no debe superar los 100MB.")
      return
    }
    try {
      const storageRef = ref(storage, `users/${uid}/videos/${archivoVideo.name}`)
      const uploadTask = uploadBytesResumable(storageRef, archivoVideo)
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          console.error("Error al subir archivo:", error)
          toast.error("Error al subir el video.")
          setUploadProgress(null)
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          const refCol = collection(db, "users", uid, "videos")
          await addDoc(refCol, {
            titulo: nuevoVideoTitulo.trim(),
            url: downloadURL,
            estado: "pendiente",
            creadoEn: new Date()
          })
          toast.success("Video subido con éxito.")
          setModalVideoOpen(false)
          setArchivoVideo(null)
          setNuevoVideoTitulo("")
          setUploadProgress(null)
          fetchData()
        }
      )
    } catch (err) {
      console.error("Upload error:", err)
      toast.error("Error al guardar video.")
      setUploadProgress(null)
    }
  }

  const handleDelete = async (type: "guiones" | "videos", id: string) => {
    try {
      const docRef = doc(db, "users", uid as string, type, id)
      await deleteDoc(docRef)
      fetchData()
    } catch {
      toast.error("Error al eliminar.")
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "video/*": [] },
    maxSize: 100 * 1024 * 1024,
    onDrop: (files) => {
      if (files.length) {
        setArchivoVideo(files[0])
      }
    },
  })

  const { getRootProps: getEditDropProps, getInputProps: getEditInputProps } = useDropzone({
    accept: { "video/*": [] },
    maxSize: 100 * 1024 * 1024,
    onDrop: (files) => {
      if (files.length) {
        setNuevoArchivoVideo(files[0])
      }
    },
  })

  useEffect(() => {
    fetchData()
    }, [fetchData])


  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (!cliente) {
    return <div className="p-6">Cliente no encontrado.</div>
  }

  return (
    <div className="p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">👤 Cliente: {cliente.email}</h1>
        {cliente.name && <p>Nombre: {cliente.name}</p>}
        {cliente.stripeLink && (
          <p>
            <a href={cliente.stripeLink} target="_blank" className="text-blue-600 underline">Ver en Stripe</a>
          </p>
        )}
      </div>

      {/* GUIONES */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">📜 Guiones</h2>
          <Dialog open={modalGuionOpen} onOpenChange={setModalGuionOpen}>
            <DialogTrigger asChild><Button>+ Crear</Button></DialogTrigger>
            <DialogContent>
              <h3 className="font-semibold text-lg mb-2">Nuevo Guion</h3>
              <Input placeholder="Título" value={nuevoGuion.titulo} onChange={(e) => setNuevoGuion((prev) => ({ ...prev, titulo: e.target.value }))} />
              <Textarea placeholder="Contenido" value={nuevoGuion.contenido} onChange={(e) => setNuevoGuion((prev) => ({ ...prev, contenido: e.target.value }))} />
              <Button onClick={handleCreateGuion} className="mt-2">Guardar</Button>
            </DialogContent>
          </Dialog>
        </div>
        {guiones.length === 0 ? (
          <p className="text-muted-foreground">Este cliente no tiene guiones aún.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {guiones.map((g) => (
              <Card key={g.firebaseId} className="p-3 cursor-pointer" onClick={() => setGuionSeleccionado(g)}>
                <p className="font-semibold text-base">{g.titulo}</p>
                <p className="text-muted-foreground whitespace-pre-line">{g.contenido}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* VIDEOS */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-semibold">🎬 Videos</h2>
          <Dialog open={modalVideoOpen} onOpenChange={setModalVideoOpen}>
            <DialogTrigger asChild><Button>+ Crear</Button></DialogTrigger>
            <DialogContent>
              <h3 className="font-semibold text-lg mb-2">Subir video</h3>
              <Input placeholder="Título del video" value={nuevoVideoTitulo} onChange={(e) => setNuevoVideoTitulo(e.target.value)} />
              <div {...getRootProps()} className={`border border-dashed rounded-md p-4 text-center cursor-pointer ${isDragActive ? "border-blue-500" : "border-gray-300"}`}>
                <input {...getInputProps()} />
                {archivoVideo ? <p className="text-sm">{archivoVideo.name}</p> : <p className="text-sm text-muted-foreground">Arrastra un video aquí o haz clic para seleccionar uno (máx. 100MB)</p>}
              </div>
              <Button onClick={handleUploadVideo} className="mt-2 w-full" disabled={uploadProgress !== null}>
                {uploadProgress !== null ? `Subiendo... ${uploadProgress.toFixed(0)}%` : "Subir"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
        {videos.length === 0 ? (
          <p className="text-muted-foreground">Este cliente no tiene videos aún.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((v) => (
              <Card key={v.firebaseId} className="p-3 cursor-pointer" onClick={() => setVideoSeleccionado(v)}>
                <p className="font-semibold text-base">{v.titulo}</p>
                <video controls src={v.url} className="rounded w-full aspect-[9/16] object-cover" />
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* MODALES EDICIÓN */}
      <Dialog open={!!guionSeleccionado} onOpenChange={() => setGuionSeleccionado(null)}>
        <DialogContent>
          <h3 className="text-lg font-bold mb-2">Editar Guion</h3>
          <Input value={guionSeleccionado?.titulo || ""} onChange={(e) => setGuionSeleccionado(prev => prev && ({ ...prev, titulo: e.target.value }))} />
          <Textarea value={guionSeleccionado?.contenido || ""} onChange={(e) => setGuionSeleccionado(prev => prev && ({ ...prev, contenido: e.target.value }))} />
          <div className="flex gap-2 mt-3">
            <Button variant="destructive" onClick={() => handleDelete("guiones", guionSeleccionado!.firebaseId)}>Eliminar</Button>
            <Button onClick={handleUpdateGuion}>Guardar Cambios</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!videoSeleccionado} onOpenChange={() => { setVideoSeleccionado(null); setNuevoArchivoVideo(null); }}>
        <DialogContent>
          <h3 className="text-lg font-bold mb-2">Editar Video</h3>
          <Input value={videoSeleccionado?.titulo || ""} onChange={(e) => setVideoSeleccionado(prev => prev && ({ ...prev, titulo: e.target.value }))} />
          <video controls src={videoSeleccionado?.url} className="rounded w-full aspect-[9/16] object-cover my-2" />
          <div {...getEditDropProps()} className="border border-dashed rounded-md p-4 text-center cursor-pointer">
            <input {...getEditInputProps()} />
            {nuevoArchivoVideo ? <p className="text-sm">{nuevoArchivoVideo.name}</p> : <p className="text-sm text-muted-foreground">Sube nueva versión del video (opcional)</p>}
          </div>
          <div className="flex gap-2 mt-3">
            <Button variant="destructive" onClick={() => handleDelete("videos", videoSeleccionado!.firebaseId)}>Eliminar</Button>
            <Button onClick={handleUpdateVideo}>Guardar Cambios</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
