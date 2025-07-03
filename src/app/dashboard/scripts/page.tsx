"use client"

import { useEffect, useState } from "react"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  DocumentData,
} from "firebase/firestore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

interface Guion {
  firebaseId: string
  titulo: string
  contenido: string
  createdAt?: string
}


export default function GuionesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [guiones, setGuiones] = useState<Guion[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedGuion, setSelectedGuion] = useState<Guion | null>(null)
  const [tituloEditado, setTituloEditado] = useState("")
  const [contenidoEditado, setContenidoEditado] = useState("")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid)
        await fetchGuiones(user.uid)
      } else {
        setUserId(null)
        setGuiones([])
        setLoading(false)
        toast.error("No estás autenticado", {
          description: "Por favor inicia sesión para ver tus guiones.",
        })
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchGuiones = async (uid: string) => {
    try {
      const ref = collection(db, "users", uid, "guiones")
      const snapshot = await getDocs(ref)

      if (snapshot.empty) {
        toast("Aún no tienes guiones", {
          description: "Cuando los generes, aparecerán aquí.",
        })
      }

      const data: Guion[] = snapshot.docs.map((doc) => {
        const docData = doc.data() as Omit<Guion, "firebaseId">
        return {
            firebaseId: doc.id,
            ...docData,
        }
        })

      setGuiones(data)
    } catch (error) {
      console.error("Error al obtener guiones:", error)
      toast.error("Error al cargar guiones", {
        description: "Intenta recargar la página.",
      })
    } finally {
      setLoading(false)
    }
  }

  const openEditor = (guion: Guion) => {
    setSelectedGuion(guion)
    setTituloEditado(guion.titulo)
    setContenidoEditado(guion.contenido)
    setOpen(true)
  }

  const guardarCambios = async () => {
    if (!userId || !selectedGuion) return

    try {
      const ref = doc(db, "users", userId, "guiones", selectedGuion.firebaseId)
      await updateDoc(ref, {
        titulo: tituloEditado,
        contenido: contenidoEditado,
      })

      // Actualizar en el estado local
      const nuevosGuiones = guiones.map((g) =>
        g.firebaseId === selectedGuion.firebaseId
          ? { ...g, titulo: tituloEditado, contenido: contenidoEditado }
          : g
      )
      setGuiones(nuevosGuiones)
      toast.success("Guion actualizado")
      setOpen(false)
    } catch (error) {
      console.error("Error al actualizar guion:", error)
      toast.error("Error al guardar cambios")
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Mis Guiones</h1>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : guiones.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {guiones.map((guion) => (
            <Card
              key={guion.firebaseId}
              className="cursor-pointer hover:shadow-lg transition"
              onClick={() => openEditor(guion)}
            >
              <CardContent className="p-4">
                <h2 className="font-semibold text-lg mb-2">{guion.titulo}</h2>
                <p className="text-sm text-muted-foreground line-clamp-4">
                  {guion.contenido}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No hay guiones disponibles.</p>
      )}

      {/* Modal de edición */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Guion</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={tituloEditado}
              onChange={(e) => setTituloEditado(e.target.value)}
              placeholder="Título"
            />
            <Textarea
              value={contenidoEditado}
              onChange={(e) => setContenidoEditado(e.target.value)}
              rows={6}
              placeholder="Contenido del guion"
            />
            <Button onClick={guardarCambios}>Guardar cambios</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
