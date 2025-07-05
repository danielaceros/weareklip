"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { db, storage } from "@/lib/firebase"
import {
  getDoc,
  updateDoc,
  doc,
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
} from "firebase/firestore"
import { ref as storageRef, deleteObject } from "firebase/storage"
import { FiDownload, FiEye, FiTrash2 } from "react-icons/fi"

type Client = {
  uid: string
  email: string
  role: string
  subStatus: string
  planName: string | null
  stripeCustomerId?: string
}

interface UserData {
  name?: string
  instagramUser?: string
  phone?: string
  photoURL?: string
}

interface ClonacionVideo {
  id: string
  titulo: string
  url: string
  storagePath: string
}

const isActive = (status: string) =>
  ["active", "trialing", "past_due", "unpaid"].includes(status)

const getBadgeVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
  switch (status) {
    case "active":
    case "trialing":
      return "default"
    case "past_due":
    case "unpaid":
      return "destructive"
    case "cancelled":
    case "none":
      return "secondary"
    case "no_customer":
    default:
      return "outline"
  }
}

const getBadgeLabel = (status: string): string => {
  switch (status) {
    case "active":
      return "Activa"
    case "trialing":
      return "En prueba"
    case "past_due":
      return "Pago vencido"
    case "unpaid":
      return "Impago"
    case "cancelled":
      return "Cancelada"
    case "none":
      return "Sin suscripción"
    case "no_customer":
      return "No registrado"
    default:
      return "Desconocido"
  }
}

const deduplicateClients = (clients: Client[]): Client[] => {
  const map = new Map<string, Client>()
  for (const client of clients) {
    const existing = map.get(client.email)
    if (!existing || (!isActive(existing.subStatus) && isActive(client.subStatus))) {
      map.set(client.email, client)
    }
  }
  return Array.from(map.values())
}

export default function ClientsAdminPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastId, setLastId] = useState<string | null>(null)

  // Modal y detalles usuario
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [realUid, setRealUid] = useState<string | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [videos, setVideos] = useState<ClonacionVideo[]>([])
  const [loadingUserData, setLoadingUserData] = useState(false)
  const [savingUserData, setSavingUserData] = useState(false)

  // Modal confirmación eliminación
  const [videoToDelete, setVideoToDelete] = useState<ClonacionVideo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchClients = useCallback(
    async (term = "", reset = false) => {
      if (loading || (!hasMore && !reset)) return
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (term) params.append("email", term)
        if (lastId && !reset) params.append("starting_after", lastId)

        const res = await fetch(`/api/stripe/clients?${params.toString()}`)
        const json = await res.json()

        if (!res.ok || !json.data) {
          throw new Error(json.error || "Error al obtener clientes")
        }

        const { data, lastId: newLastId, hasMore: more } = json

        const updatedList = reset ? data : [...clients, ...data]
        const deduplicated = deduplicateClients(updatedList)

        setClients(deduplicated)
        setLastId(newLastId || null)
        setHasMore(more)
      } catch (error) {
        console.error(error)
        toast.error("Error al cargar clientes")
      } finally {
        setLoading(false)
      }
    },
    [clients, loading, lastId, hasMore]
  )

  const handleSearch = () => {
    setClients([])
    setLastId(null)
    setHasMore(true)
    fetchClients(search.trim(), true)
  }

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchClients(search)
        }
      },
      { threshold: 1 }
    )

    const el = bottomRef.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [fetchClients, hasMore, loading, search])

  const filteredClients = clients.filter((c) => {
    if (filter === "active") return isActive(c.subStatus)
    if (filter === "inactive") return !isActive(c.subStatus)
    return true
  })

  // Obtiene UID real de usuario por email
  const fetchUidByEmail = async (email: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/get-uid-by-email?email=${encodeURIComponent(email)}`)
      if (!res.ok) {
        toast.error("No se pudo obtener UID para el email seleccionado.")
        return null
      }
      const data = await res.json()
      return data.uid ?? null
    } catch (e) {
      console.error("Error fetchUidByEmail", e)
      toast.error("Error obteniendo UID del usuario")
      return null
    }
  }

  // Carga datos usuario y videos clonacion al seleccionar cliente
  useEffect(() => {
    if (!selectedClient) {
      setUserData(null)
      setVideos([])
      setRealUid(null)
      return
    }
    setLoadingUserData(true)
    setUserData(null)
    setVideos([])
    setRealUid(null)

    fetchUidByEmail(selectedClient.email).then((uid) => {
      if (!uid) {
        setLoadingUserData(false)
        return
      }
      setRealUid(uid)

      getDoc(doc(db, "users", uid))
        .then((docSnap) => {
          if (docSnap.exists()) setUserData(docSnap.data() as UserData)
          else setUserData(null)
        })
        .catch(() => {
          toast.error("Error cargando datos del usuario")
          setUserData(null)
        })

      const q = query(collection(db, "users", uid, "clonacion"), orderBy("createdAt", "desc"))
      getDocs(q)
        .then((qs) => {
          const vids: ClonacionVideo[] = []
          qs.forEach((d) => {
            const data = d.data()
            vids.push({
              id: d.id,
              titulo: data.titulo ?? "Sin título",
              url: data.url,
              storagePath: data.storagePath,
            })
          })
          setVideos(vids)
        })
        .catch(() => {
          toast.error("Error cargando vídeos del usuario")
          setVideos([])
        })
        .finally(() => setLoadingUserData(false))
    })
  }, [selectedClient])

  // Guardar datos usuario
  const saveUserData = async () => {
    if (!realUid) return
    setSavingUserData(true)
    try {
      await updateDoc(doc(db, "users", realUid), {
        name: userData?.name?.trim() ?? "",
        instagramUser: userData?.instagramUser?.trim() ?? "",
        phone: userData?.phone?.trim() ?? "",
        photoURL: userData?.photoURL ?? "",
      })
      toast.success("Datos de usuario actualizados")
    } catch (e) {
      console.error(e)
      toast.error("Error guardando datos")
    } finally {
      setSavingUserData(false)
    }
  }

  // Descargar vídeo usando endpoint proxy
  const handleDownloadVideo = (video: ClonacionVideo) => {
    const downloadUrl = `/api/download-video?url=${encodeURIComponent(video.url)}`
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = `video.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Confirmar y eliminar vídeo
  const confirmDeleteVideo = (video: ClonacionVideo) => {
    setVideoToDelete(video)
  }

  const handleDeleteConfirmed = async () => {
    if (!realUid || !videoToDelete) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, "users", realUid, "clonacion", videoToDelete.id))
      const videoRef = storageRef(storage, videoToDelete.storagePath)
      await deleteObject(videoRef)
      setVideos((v) => v.filter((x) => x.id !== videoToDelete.id))
      toast.success("Vídeo eliminado")
      setVideoToDelete(null)
    } catch (e) {
      console.error(e)
      toast.error("Error eliminando vídeo")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Lista de Clientes</h1>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Input
          placeholder="Buscar por email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </Button>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredClients.length === 0 && !loading && (
        <p className="text-muted-foreground mt-6">No hay resultados.</p>
      )}

      {filteredClients.map((c) => (
        <Card
          key={c.stripeCustomerId || c.uid}
          className="p-4 space-y-1 cursor-pointer hover:bg-gray-50"
          onClick={() => setSelectedClient(c)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setSelectedClient(c)
          }}
          role="button"
          aria-label={`Ver detalles de cliente ${c.email}`}
        >
          <div className="flex justify-between items-center">
            <div>
              <p>
                <strong>{c.email}</strong> {c.role && `– ${c.role}`}
              </p>
              <p>Plan: {c.planName || "-"}</p>
            </div>
            <Badge variant={getBadgeVariant(c.subStatus)}>
              {getBadgeLabel(c.subStatus)}
            </Badge>
          </div>
        </Card>
      ))}

      {loading && (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-t-transparent border-primary rounded-full animate-spin" />
        </div>
      )}

      <div ref={bottomRef} className="h-10" />

      {/* Modal detalles cliente */}
      {selectedClient && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedClient(null)}>
          <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>Detalles de {selectedClient.email}</DialogTitle>
            </DialogHeader>

            {loadingUserData ? (
              <p>Cargando datos...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Datos editable */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={userData?.name || ""}
                      onChange={(e) =>
                        setUserData((d) => ({ ...(d ?? {}), name: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="instagramUser">Usuario Instagram</Label>
                    <Input
                      id="instagramUser"
                      value={userData?.instagramUser || ""}
                      onChange={(e) =>
                        setUserData((d) => ({ ...(d ?? {}), instagramUser: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={userData?.phone || ""}
                      onChange={(e) =>
                        setUserData((d) => ({ ...(d ?? {}), phone: e.target.value }))
                      }
                    />
                  </div>

                  <Button onClick={saveUserData} disabled={savingUserData}>
                    {savingUserData ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>

                {/* Videos clonacion simplificado */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold mb-2">
                    Vídeos de Clonación ({videos.length})
                  </h3>

                  {videos.length === 0 && <p>No hay vídeos subidos.</p>}

                  <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                    {videos.map((video) => (
                      <div
                        key={video.id}
                        className="flex items-center justify-end gap-2 border rounded p-2"
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label="Ver vídeo"
                          onClick={() => window.open(video.url, "_blank", "noopener")}
                        >
                          <FiEye />
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          aria-label="Descargar vídeo"
                          onClick={() => handleDownloadVideo(video)}
                        >
                          <FiDownload />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          aria-label="Eliminar vídeo"
                          onClick={() => confirmDeleteVideo(video)}
                        >
                          <FiTrash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Modal confirmación eliminación vídeo */}
      <Dialog open={!!videoToDelete} onOpenChange={() => !videoToDelete && setVideoToDelete(null)}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p>
            ¿Estás seguro que quieres eliminar el vídeo{" "}
            <strong>{videoToDelete?.titulo}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setVideoToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirmed}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
