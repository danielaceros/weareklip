"use client" 

import { useEffect, useState, useCallback } from "react"
import { auth, db } from "@/lib/firebase"
import type { User } from "firebase/auth"
import { onAuthStateChanged } from "firebase/auth"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import { es } from 'date-fns/locale'
import { useRouter } from "next/navigation"
import { 
  collection, 
  getDocs,
  query,
  orderBy,
  limit
} from "firebase/firestore"

type SubscriptionStatus =
  | "loading"
  | "active"
  | "trialing"
  | "incomplete"
  | "canceled"
  | "no_active"

type Estado = "por_hacer" | "en_proceso" | "completado"

type Evento = {
  id: string;
  tipo: "guion" | "video";
  titulo: string;
  fecha: string;
  estado: Estado;
  refId: string;
}

type UltimoGuion = {
  id: string;
  titulo: string;
  contenido: string;
  estado: number;
  createdAt?: string;
}

type UltimoVideo = {
  id: string;
  titulo: string;
  url: string;
  estado: number;
  createdAt?: string;
}

interface DashboardStats {
  subscripcion: {
    status: SubscriptionStatus
    plan: string
    renovacion: string
  }
  guiones: {
    nuevos: number
    cambios: number
    aprobados: number
  }
  videos: number
}

function formatDateToISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Date | undefined>(undefined)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [ultimoGuion, setUltimoGuion] = useState<UltimoGuion | null>(null)
  const [ultimoVideo, setUltimoVideo] = useState<UltimoVideo | null>(null)
  const [, setStats] = useState<DashboardStats>({
    subscripcion: {
      status: "loading",
      plan: "Desconocido",
      renovacion: "Desconocida",
    },
    guiones: {
      nuevos: 0,
      cambios: 0,
      aprobados: 0
    },
    videos: 0
  })

  const router = useRouter()

  const fetchEventos = useCallback(async (uid: string) => {
    try {
      const snap = await getDocs(collection(db, "users", uid, "calendario"))
      const data = snap.docs.map((doc) => {
        const d = doc.data()
        const fechaDate = d.fecha.toDate()
        return {
          id: doc.id,
          tipo: d.tipo,
          titulo: d.titulo,
          fecha: formatDateToISO(fechaDate),
          estado: d.estado || "por_hacer",
          refId: d.refId
        }
      })
      setEventos(data)
    } catch (error) {
      console.error("Error cargando eventos:", error)
    }
  }, [])

  const fetchUltimoGuion = useCallback(async (uid: string) => {
    try {
      const q = query(
        collection(db, "users", uid, "guiones"),
        orderBy("creadoEn", "desc"),
        limit(1)
      )
      const snap = await getDocs(q)
      
      if (!snap.empty) {
        const doc = snap.docs[0]
        const data = doc.data()
        setUltimoGuion({
          id: doc.id,
          titulo: data.titulo || "Sin título",
          contenido: data.contenido || "",
          estado: data.estado || 0,
          createdAt: data.creadoEn
        })
      }
    } catch (error) {
      console.error("Error cargando último guión:", error)
      // Si falla con orderBy, intentar sin ordenar
      try {
        const snapFallback = await getDocs(collection(db, "users", uid, "guiones"))
        if (!snapFallback.empty) {
          const doc = snapFallback.docs[0]
          const data = doc.data()
          setUltimoGuion({
            id: doc.id,
            titulo: data.titulo || "Sin título",
            contenido: data.contenido || "",
            estado: data.estado || 0,
            createdAt: data.creadoEn
          })
        }
      } catch (fallbackError) {
        console.error("Error en fallback de guiones:", fallbackError)
      }
    }
  }, [])

  const fetchUltimoVideo = useCallback(async (uid: string) => {
    try {
      const q = query(
        collection(db, "users", uid, "videos"),
        orderBy("creadoEn", "desc"),
        limit(1)
      )
      const snap = await getDocs(q)
      
      if (!snap.empty) {
        const doc = snap.docs[0]
        const data = doc.data()
        setUltimoVideo({
          id: doc.id,
          titulo: data.titulo || "Sin título",
          url: data.url || "",
          estado: Number(data.estado) || 0,
          createdAt: data.creadoEn
        })
      }
    } catch (error) {
      console.error("Error cargando último video:", error)
      // Si falla con orderBy, intentar sin ordenar
      try {
        const snapFallback = await getDocs(collection(db, "users", uid, "videos"))
        if (!snapFallback.empty) {
          const doc = snapFallback.docs[0]
          const data = doc.data()
          setUltimoVideo({
            id: doc.id,
            titulo: data.titulo || "Sin título",
            url: data.url || "",
            estado: Number(data.estado) || 0,
            createdAt: data.creadoEn
          })
        }
      } catch (fallbackError) {
        console.error("Error en fallback de videos:", fallbackError)
      }
    }
  }, [])

  const fetchStats = useCallback(async (uid: string) => {
    try {
      // Obtener estadísticas de guiones
      const guionesSnap = await getDocs(collection(db, "users", uid, "guiones"))
      let nuevos = 0, cambios = 0, aprobados = 0
      
      guionesSnap.docs.forEach(doc => {
        const data = doc.data()
        const estado = data.estado || 0
        
        switch (estado) {
          case 0:
            nuevos++
            break
          case 1:
            cambios++
            break
          case 2:
            aprobados++
            break
        }
      })

      // Obtener total de videos
      const videosSnap = await getDocs(collection(db, "users", uid, "videos"))
      const totalVideos = videosSnap.size

      setStats(prev => ({
        ...prev,
        guiones: {
          nuevos,
          cambios,
          aprobados
        },
        videos: totalVideos
      }))
    } catch (error) {
      console.error("Error cargando estadísticas:", error)
    }
  }, [])

  const fetchData = useCallback(async (user: User) => {
    try {
      const token = await user.getIdToken()
      const res = await fetch("/api/stripe/subscription", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()

      setStats(prev => ({
        ...prev,
        subscripcion: {
          status: data.status ?? "no_active",
          plan: data.plan ?? "Desconocido",
          renovacion: data.current_period_end
            ? new Date(data.current_period_end * 1000).toLocaleDateString("es-ES")
            : "Desconocida",
        },
      }))

      // Cargar datos
      await Promise.all([
        fetchEventos(user.uid),
        fetchUltimoGuion(user.uid),
        fetchUltimoVideo(user.uid),
        fetchStats(user.uid)
      ])
    } catch (error: unknown) {
      const message = "Error desconocido"
      console.error("Error al cargar dashboard:", error)
      toast.error("No se pudo cargar la suscripción", {
        description: message,
        duration: 8000,
      })

      setStats((prev) => ({
        ...prev,
        subscripcion: {
          status: "no_active",
          plan: "No activa",
          renovacion: "Desconocida",
        },
      }))
    } finally {
      setLoading(false)
    }
  }, [fetchEventos, fetchUltimoGuion, fetchUltimoVideo, fetchStats])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        toast.error("No autenticado", {
          description: "Debes iniciar sesión para ver tu panel.",
        })
        setLoading(false)
        return
      }

      fetchData(user)
    })

    return () => unsubscribe()
  }, [fetchData])

  // Lógica del calendario
  type DiaInfo = {
    estado: Estado | null;
    cantidad: number;
  };

  const eventosPorDia: Record<string, DiaInfo> = {};

  eventos.forEach(evento => {
    const fecha = evento.fecha;
    if (!eventosPorDia[fecha]) {
      eventosPorDia[fecha] = {
        estado: evento.estado,
        cantidad: 1
      };
    } else {
      eventosPorDia[fecha].cantidad += 1;
      
      const estados = [eventosPorDia[fecha].estado, evento.estado];
      if (estados.includes("por_hacer")) {
        eventosPorDia[fecha].estado = "por_hacer";
      } else if (estados.includes("en_proceso")) {
        eventosPorDia[fecha].estado = "en_proceso";
      } else {
        eventosPorDia[fecha].estado = "completado";
      }
    }
  });

  const fechasPorHacer: Date[] = [];
  const fechasEnProceso: Date[] = [];
  const fechasCompletado: Date[] = [];

  Object.entries(eventosPorDia).forEach(([fechaISO, info]) => {
    const [year, month, day] = fechaISO.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    
    if (info.estado === "por_hacer") {
      fechasPorHacer.push(fecha);
    } else if (info.estado === "en_proceso") {
      fechasEnProceso.push(fecha);
    } else if (info.estado === "completado") {
      fechasCompletado.push(fecha);
    }
  });

  const eventosDelDia = selected
    ? eventos.filter((e) => e.fecha === formatDateToISO(selected))
    : [];

  const getEstadoBadge = (estado: number) => {
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

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground animate-pulse">
        <p className="text-lg">🔄 Cargando tu dashboard...</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .event-day-por-hacer {
          background-color: #fee2e2 !important;
          border-radius: 0.375rem !important;
        }
        
        .event-day-en-proceso {
          background-color: #ffedd5 !important;
          border-radius: 0.375rem !important;
        }
        
        .event-day-completado {
          background-color: #dcfce7 !important;
          border-radius: 0.375rem !important;
        }

        .rdp-day_selected:not([disabled]) {
          background-color: #3b82f6 !important;
          color: white !important;
          border-radius: 0.375rem !important;
        }

        /* Ajustes responsive para el calendario */
        @media (max-width: 1024px) {
          .rdp {
            font-size: 0.875rem;
          }
          
          .rdp-table {
            max-width: 100%;
            width: 100%;
          }
          
          .rdp-cell {
            width: 2rem;
            height: 2rem;
          }
          
          .rdp-button {
            width: 1.75rem;
            height: 1.75rem;
            font-size: 0.75rem;
          }
        }

        @media (max-width: 640px) {
          .rdp {
            font-size: 0.75rem;
          }
          
          .rdp-cell {
            width: 1.5rem;
            height: 1.5rem;
          }
          
          .rdp-button {
            width: 1.25rem;
            height: 1.25rem;
            font-size: 0.625rem;
          }
        }

        /* Estilos para el video mejorado - Formato 9:16 vertical */
        .video-container {
          position: relative;
          width: 100%;
          max-width: 250px; /* Limitar ancho máximo */
          margin: 0 auto;
          background: #f3f4f6;
          border-radius: 0.5rem;
          overflow: hidden;
        }
        
        .video-container.vertical {
          aspect-ratio: 9/16; /* Formato vertical para móviles */
        }
        
        .video-container video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      `}</style>

      <div className="p-6 space-y-8">
        <h1 className="text-2xl font-bold">¡Hola! 👋 Bienvenido a tu Panel</h1>
        <p className="text-muted-foreground">
          Desde aquí puedes ver el estado de tus proyectos y fechas de entrega. ¡Mantente al día! 🚀
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Card 1: Calendario de Entregas */}
          <Card className="p-3 lg:p-4">
            <h2 className="font-semibold text-base lg:text-lg mb-3">📅 Calendario</h2>
            <div className="space-y-3 lg:space-y-4">
              <div className="w-full overflow-hidden">
                <DayPicker
                  mode="single"
                  selected={selected}
                  onSelect={setSelected}
                  modifiers={{
                    porHacer: fechasPorHacer,
                    enProceso: fechasEnProceso,
                    completado: fechasCompletado
                  }}
                  modifiersClassNames={{
                    porHacer: "event-day-por-hacer",
                    enProceso: "event-day-en-proceso",
                    completado: "event-day-completado"
                  }}
                  locale={es}
                  fixedWeeks
                  pagedNavigation
                  showOutsideDays
                  className="text-left text-xs lg:text-sm mx-auto"
                  formatters={{
                    formatWeekdayName: (weekday) => {
                      const weekdays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
                      return weekdays[weekday.getDay()];
                    }
                  }}
                />
              </div>
              
              {/* Eventos del día seleccionado */}
              {selected && (
                <div>
                  <h4 className="font-medium text-sm mb-2">
                    {selected.toLocaleDateString('es-ES')}
                  </h4>
                  {eventosDelDia.length === 0 ? (
                    <p className="text-xs text-gray-500">Sin entregas</p>
                  ) : (
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {eventosDelDia.map((e) => {
                        let estadoColor = "";
                        switch (e.estado) {
                          case "por_hacer":
                            estadoColor = "bg-red-100 text-red-800";
                            break;
                          case "en_proceso":
                            estadoColor = "bg-orange-100 text-orange-800";
                            break;
                          case "completado":
                            estadoColor = "bg-green-100 text-green-800";
                            break;
                        }
                        
                        return (
                          <div key={e.id} className={`text-xs p-2 rounded ${estadoColor}`}>
                            <span>{e.tipo === "guion" ? "📜" : "🎬"} {e.titulo}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {/* Leyenda compacta */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 bg-red-200 rounded"></div>
                  <span>Por hacer</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 bg-orange-200 rounded"></div>
                  <span>En proceso</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 bg-green-200 rounded"></div>
                  <span>Completado</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 2: Último Guión */}
          <Card className="p-3 lg:p-4">
            <h2 className="font-semibold text-base lg:text-lg mb-3">📜 Último Guión</h2>
            <div className="space-y-3 lg:space-y-4">
              {ultimoGuion ? (
                <>
                  <div>
                    <h3 className="font-medium text-base mb-2 line-clamp-2">{ultimoGuion.titulo}</h3>
                    <div className="mb-3">
                      {getEstadoBadge(ultimoGuion.estado)}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                      {ultimoGuion.contenido.substring(0, 150)}
                      {ultimoGuion.contenido.length > 150 ? "..." : ""}
                    </p>
                  </div>
                  <Button 
                    onClick={() => router.push('/dashboard/scripts')}
                    className="w-full"
                    variant="outline"
                  >
                    Ver todos los guiones
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 mb-4">📄 No tienes guiones aún</p>
                    <p className="text-xs text-gray-400">Cuando se generen, aparecerán aquí</p>
                  </div>
                  <Button 
                    onClick={() => router.push('/dashboard/scripts')}
                    className="w-full"
                    variant="outline"
                  >
                    Ver guiones
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* Card 3: Último Video - MEJORADO */}
          <Card className="p-3 lg:p-4">
            <h2 className="font-semibold text-base lg:text-lg mb-3">🎬 Último Video</h2>
            <div className="space-y-3 lg:space-y-4">
              {ultimoVideo ? (
                <>
                  <div>
                    <h3 className="font-medium text-base mb-2 line-clamp-2">{ultimoVideo.titulo}</h3>
                    {/* AGREGADO: Badge de estado para el video */}
                    <div className="mb-3">
                      {getEstadoBadge(ultimoVideo.estado)}
                    </div>
                    {ultimoVideo.url && (
                      <div className="mb-4">
                        {/* MEJORADO: Video en formato 9:16 vertical */}
                        <div className="video-container vertical">
                          <video
                            controls
                            src={ultimoVideo.url}
                            preload="metadata"
                            className="rounded"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={() => router.push('/dashboard/videos')}
                    className="w-full"
                    variant="outline"
                  >
                    Ver todos los videos
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 mb-4">🎥 No tienes videos aún</p>
                    <p className="text-xs text-gray-400">Cuando estén listos, los verás aquí</p>
                  </div>
                  <Button 
                    onClick={() => router.push('/dashboard/videos')}
                    className="w-full"
                    variant="outline"
                  >
                    Ver videos
                  </Button>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}