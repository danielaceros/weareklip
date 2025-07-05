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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Combobox } from "@/components/ui/combobox"
import { db } from "@/lib/firebase"
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
  collection,
  query,
} from "firebase/firestore"
import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Pencil, Trash } from "lucide-react"

// tipos

type Script = {
  firebaseId: string
  titulo: string
  contenido: string
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

const notifyScriptAction = async (email: string, subject: string, content: string) => {
  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject,
        content,
      }),
    })
  } catch (err) {
    console.error("Error enviando email:", err)
  }
}

export default function ScriptAdminPage() {
  const [scriptsByEmail, setScriptsByEmail] = useState<Record<string, Script[]>>({})
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingScript, setEditingScript] = useState<Script | null>(null)

  const [email, setEmail] = useState("")
  const [titulo, setTitulo] = useState("")
  const [contenido, setContenido] = useState("")
  const [estado, setEstado] = useState("0")

  const [clientesActivos, setClientesActivos] = useState<ClienteActivo[]>([])
  const [submitting, setSubmitting] = useState(false)

  const isActive = (status: string) =>
    ["active", "trialing", "past_due", "unpaid"].includes(status)

  const fetchActivos = useCallback(async () => {
    try {
      const res = await fetch("/api/stripe/clients")
      const { data } = await res.json()

      const map = new Map<string, ClienteActivo>()
      for (const c of data) {
        if (!map.has(c.email) || isActive(c.subStatus)) {
          map.set(c.email, c)
        }
      }

      setClientesActivos(Array.from(map.values()).filter(c => isActive(c.subStatus ?? "")))
    } catch (err) {
      console.error("Error al cargar clientes activos:", err)
      toast.error("No se pudieron cargar los clientes.")
    }
  }, [])

  useEffect(() => {
    fetchScripts()
    fetchActivos()
  }, [fetchActivos])

  const fetchScripts = async () => {
    try {
      const snapshot = await getDocs(query(collectionGroup(db, "guiones")))
      const grouped: Record<string, Script[]> = {}

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Script
        const uid = docSnap.ref.path.split("/")[1]
        const firebaseId = docSnap.id

        let userEmail = uid
        try {
          const userSnap = await getDoc(doc(db, "users", uid))
          userEmail = userSnap.exists() ? userSnap.data()?.email || uid : uid
        } catch (e) {
          console.warn(`Error obteniendo usuario ${uid}:`, e)
        }

        if (!grouped[userEmail]) grouped[userEmail] = []
        grouped[userEmail].push({ ...data, userId: uid, firebaseId })
      }

      setScriptsByEmail(grouped)
    } catch (err) {
      console.error("Error cargando guiones:", err)
      toast.error("Error al cargar los guiones.")
    } finally {
      setLoading(false)
    }
  }

  const clienteOptions = clientesActivos.map((c) => ({
    label: `${c.email} (${c.planName ?? "Sin plan"})`,
    value: c.email,
    badge: "Activo",
  }))

  const resetForm = () => {
    setEmail("")
    setTitulo("")
    setContenido("")
    setEstado("0")
    setEditingScript(null)
  }

  const handleCreateOrEditScript = async () => {
    if (!email || !titulo || !contenido) {
      toast.warning("Todos los campos son obligatorios.")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch(`/api/get-uid-by-email?email=${encodeURIComponent(email)}`)
      const { uid } = await res.json()

      if (!res.ok || !uid) throw new Error("UID no encontrado.")

      const payload = {
        titulo,
        contenido,
        estado: parseInt(estado),
        ...(editingScript ? {} : { createdAt: Timestamp.now() }),
      }

      if (editingScript) {
        await updateDoc(doc(db, `users/${uid}/guiones/${editingScript.firebaseId}`), payload)
        toast.success("Guión actualizado.")
        await notifyScriptAction(email, "✏️ Tu guión ha sido actualizado", `El guión "${titulo}" ha sido actualizado por el equipo.`)
      } else {
        await addDoc(collection(db, `users/${uid}/guiones`), payload)
        toast.success("Guión creado correctamente.")
        await notifyScriptAction(email, "📜 Nuevo guión disponible", `Se ha creado un nuevo guión titulado "${titulo}". Revísalo en tu panel.`)
      }

      resetForm()
      setModalOpen(false)
      fetchScripts()
    } catch (err) {
      console.error(err)
      toast.error("Error al guardar el guión.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteScript = async (uid: string, scriptId: string, email: string, titulo: string) => {
    try {
      await deleteDoc(doc(db, `users/${uid}/guiones/${scriptId}`))
      toast.success("Guión eliminado.")
      await notifyScriptAction(email, "🗑️ Guión eliminado", `El guión "${titulo}" ha sido eliminado por el equipo.`)
      fetchScripts()
    } catch (err) {
      console.error("Error al eliminar guión:", err)
      toast.error("No se pudo eliminar el guión.")
    }
  }

  const handleEstadoChange = async (
    newEstado: string,
    userId: string,
    scriptId: string,
    email: string,
    titulo: string
  ) => {
    try {
      await updateDoc(doc(db, `users/${userId}/guiones/${scriptId}`), {
        estado: parseInt(newEstado),
      })
      toast.success("Estado actualizado.")
      fetchScripts()
      const estados: Record<string, string> = {
        "0": "🆕 Nuevo",
        "1": "✏️ Cambios",
        "2": "✅ Aprobado"
      }
      await notifyScriptAction(email, `🎯 Estado actualizado: ${estados[newEstado]}`, `Tu guión "${titulo}" ahora está marcado como: <strong>${estados[newEstado]}</strong>`)
    } catch (err) {
      console.error("Error actualizando estado:", err)
      toast.error("No se pudo actualizar el estado del guión.")
    }
  }

  const handleEditClick = (script: Script, email: string) => {
    setEditingScript(script)
    setEmail(email)
    setTitulo(script.titulo)
    setContenido(script.contenido)
    setEstado(String(script.estado))
    setModalOpen(true)
  }

  return (
    <div className="relative p-6">
      <h1 className="text-2xl font-bold mb-6">📜 Guiones por Usuario</h1>

      <Dialog open={modalOpen} onOpenChange={(v) => {
        setModalOpen(v)
        if (!v) resetForm()
      }}>
        <DialogTrigger asChild>
          <Button className="absolute top-6 right-6">+ Crear Guión</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>{editingScript ? "✏️ Editar Guión" : "📝 Nuevo Guión"}</DialogTitle>
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
              <Label>Contenido</Label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm resize-none"
                rows={6}
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
              />
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
            <Button onClick={handleCreateOrEditScript} disabled={submitting}>
              {submitting ? "Guardando..." : editingScript ? "Actualizar" : "Crear Guión"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-muted-foreground mt-10">Cargando guiones...</p>
      ) : Object.keys(scriptsByEmail).length === 0 ? (
        <p className="text-muted-foreground mt-10">No hay guiones disponibles.</p>
      ) : (
        <Accordion type="multiple" className="mt-8 space-y-2">
          {Object.entries(scriptsByEmail).map(([email, scripts]) => (
            <AccordionItem key={email} value={email}>
              <AccordionTrigger>{email}</AccordionTrigger>
              <AccordionContent className="space-y-4">
                {scripts.map((script) => (
                  <Card key={script.firebaseId} className="p-4 space-y-2 relative">
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(script, email)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteScript(script.userId, script.firebaseId, email, script.titulo)}
                      >
                        <Trash className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    <p className="font-semibold">{script.titulo}</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {script.contenido}
                    </p>
                    <div>
                      <Label className="text-xs">Estado</Label>
                      <Select
                        value={String(script.estado)}
                        onValueChange={(value) =>
                          handleEstadoChange(value, script.userId, script.firebaseId, email, script.titulo)
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
      )}
    </div>
  )
}
