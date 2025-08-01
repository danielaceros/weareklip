"use client"

import { useEffect, useState } from "react"
import { collection, orderBy, query, updateDoc, doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { handleError, showSuccess } from "@/lib/errors"
import { Bell, CheckCircle, Clock, Filter } from "lucide-react"

type Log = {
  id: string
  type: "guion" | "video" | "clonacion" | "tarea" | "sistema"
  action: string
  uid: string
  userName?: string
  admin: string // Email de quien hizo el cambio
  message: string
  timestamp: { seconds: number; nanoseconds: number }
  readByAdmin: boolean
  readByClient: boolean
}

const iconosPorTipo: Record<string, string> = {
  guion: "📜",
  video: "🎥",
  clonacion: "📦",
  tarea: "🧾",
  sistema: "⚙️",
}

const mensajesAmigables: Record<string, (message: string) => string> = {
  guion: (message: string) => {
    if (message.includes("aprobó")) return "✅ Guión aprobado"
    if (message.includes("editó")) return "✏️ Guión editado"
    if (message.includes("creó")) return "📝 Nuevo guión creado"
    if (message.includes("solicitó cambios")) return "💬 Cambios solicitados en guión"
    return message
  },
  video: (message: string) => {
    if (message.includes("aprobado")) return "✅ Video aprobado"
    if (message.includes("subido")) return "🎥 Nuevo video disponible"
    if (message.includes("editado")) return "✏️ Video editado"
    return message
  },
  clonacion: (message: string) => {
    if (message.includes("subió")) return "📦 Material de clonación procesado"
    if (message.includes("procesado")) return "✅ Clonación procesada"
    return message
  },
  tarea: (message: string) => {
    if (message.includes("completada")) return "✅ Tarea completada"
    if (message.includes("asignada")) return "📋 Nueva tarea asignada"
    return message
  },
  sistema: (message: string) => {
    if (message.includes("mantenimiento")) return "🔧 Mantenimiento programado"
    if (message.includes("actualización")) return "🆙 Sistema actualizado"
    return message
  }
}

export default function AdminNotificationsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("todos")
  const [filterUser, setFilterUser] = useState("todos")
  const [filterRead, setFilterRead] = useState("todos")
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    setupRealTimeListener()
  }, [])

  const setupRealTimeListener = () => {
    const q = query(
      collection(db, "logs"), 
      orderBy("timestamp", "desc")
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Asegurar que las notificaciones sean no leídas por defecto
          readByAdmin: data.readByAdmin === true ? true : false,
          readByClient: data.readByClient === true ? true : false,
        } as Log;
      });
      
      setLogs(fetchedLogs)
      setLastUpdate(new Date())
      setLoading(false)
    }, (error) => {
      console.error("Error en tiempo real:", error)
      handleError(error, "Error en actualizaciones en tiempo real")
      setLoading(false)
    })

    return unsubscribe
  }

  const markAsRead = async (logId: string) => {
    try {
      // Actualizar inmediatamente en el estado local
      setLogs(prevLogs => 
        prevLogs.map(log => 
          log.id === logId 
            ? { ...log, readByAdmin: true }
            : log
        )
      )
      
      // Actualizar en la base de datos
      await updateDoc(doc(db, "logs", logId), {
        readByAdmin: true
      })
      
      showSuccess("Marcado como leído")
    } catch (error) {
      // Si hay error, revertir el cambio local
      setLogs(prevLogs => 
        prevLogs.map(log => 
          log.id === logId 
            ? { ...log, readByAdmin: false }
            : log
        )
      )
      handleError(error, "Error al marcar como leído")
    }
  }

  const markAllAsRead = async () => {
    const unreadLogs = logs.filter(log => !log.readByAdmin)
    if (unreadLogs.length === 0) return

    try {
      // Actualizar inmediatamente en el estado local
      setLogs(prevLogs => 
        prevLogs.map(log => 
          !log.readByAdmin
            ? { ...log, readByAdmin: true }
            : log
        )
      )
      
      // Actualizar en la base de datos
      const promises = unreadLogs.map(log => 
        updateDoc(doc(db, "logs", log.id), { readByAdmin: true })
      )
      await Promise.all(promises)
      
      showSuccess(`${unreadLogs.length} notificaciones marcadas como leídas`)
    } catch (error) {
      // Si hay error, recargar desde la base de datos
      setupRealTimeListener()
      handleError(error, "Error al marcar todas como leídas")
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Ahora mismo'
    if (diffMins < 60) return `Hace ${diffMins} min`
    if (diffHours < 24) return `Hace ${diffHours}h`
    return `Hace ${diffDays} días`
  }

  // Función para extraer email del mensaje
  const extractUserEmailFromMessage = (message: string): string => {
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    const match = message.match(emailRegex)
    return match ? match[1] : ""
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  // Obtener tipos únicos y emails únicos
  const tiposUnicos = [...new Set(logs.map((log) => log.type))]
  const emailsUnicos = [...new Set(logs.map((log) => extractUserEmailFromMessage(log.message)).filter(email => email))]

  // Filtrar por texto, tipo, email y estado de lectura
  const filteredLogs = logs.filter((log) => {
    const userEmail = extractUserEmailFromMessage(log.message)
    const matchesText = 
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      log.admin.toLowerCase().includes(search.toLowerCase()) ||
      userEmail.toLowerCase().includes(search.toLowerCase())
    
    const matchesType = filterType === "todos" || log.type === filterType
    const matchesUser = filterUser === "todos" || userEmail === filterUser
    const matchesRead = filterRead === "todos" || 
      (filterRead === "leidas" && log.readByAdmin) ||
      (filterRead === "no_leidas" && !log.readByAdmin)
    
    return matchesText && matchesType && matchesUser && matchesRead
  })

  // Contar no leídas y estadísticas
  const unreadCount = logs.filter(log => !log.readByAdmin).length
  const stats = {
    total: logs.length,
    unread: unreadCount,
    today: logs.filter(log => {
      const logDate = new Date(log.timestamp.seconds * 1000)
      const today = new Date()
      return logDate.toDateString() === today.toDateString()
    }).length
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header mejorado */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-8 h-8 text-blue-600" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">Panel Admin - Todas las Notificaciones</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 
                ? `${unreadCount} sin leer • ${stats.today} hoy` 
                : 'Todo al día ✨'
              }
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {/* Botón siempre visible */}
          <Button 
            onClick={markAllAsRead} 
            size="sm"
            variant={unreadCount > 0 ? "default" : "outline"}
            disabled={unreadCount === 0}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Marcar todas como leídas
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.unread}</div>
          <div className="text-sm text-muted-foreground">Sin leer</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.today}</div>
          <div className="text-sm text-muted-foreground">Hoy</div>
        </Card>
      </div>

      {/* Información de última actualización */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Última actualización: {formatTimeAgo(lastUpdate)} • 🟢 Actualizaciones en tiempo real</span>
      </div>

      {/* Filtros simplificados */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtros</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="🔍 Buscar notificaciones..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tiposUnicos.map((tipo) => (
                <SelectItem key={tipo} value={tipo}>
                  {iconosPorTipo[tipo]} {tipo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por usuario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los usuarios</SelectItem>
              {emailsUnicos.map((email) => (
                <SelectItem key={email} value={email}>
                  📧 {email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterRead} onValueChange={setFilterRead}>
            <SelectTrigger>
              <SelectValue placeholder="Estado de lectura" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="no_leidas">❗ No leídas</SelectItem>
              <SelectItem value="leidas">✅ Leídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de notificaciones */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">📭 No hay notificaciones</p>
          <p className="text-sm text-muted-foreground mt-2">
            {search || filterType !== "todos" || filterUser !== "todos" || filterRead !== "todos"
              ? "Ajusta los filtros para ver más resultados"
              : "Cuando haya actividad en el sistema, aparecerá aquí"
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const mensaje = mensajesAmigables[log.type] 
              ? mensajesAmigables[log.type](log.message)
              : log.message
            
            const timeAgo = formatTimeAgo(new Date(log.timestamp.seconds * 1000))
            const userEmail = extractUserEmailFromMessage(log.message)

            return (
              <Card 
                key={log.id} 
                className={`p-4 transition-all duration-200 hover:shadow-md ${
                  !log.readByAdmin 
                    ? 'border-yellow-300 bg-yellow-50 shadow-md border-l-4 border-l-yellow-500' 
                    : 'bg-white border-gray-200 opacity-90 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className="text-2xl">
                        {iconosPorTipo[log.type]}
                      </div>
                      {!log.readByAdmin && (
                        <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium">{mensaje}</p>
                        
                        {!log.readByAdmin && (
                          <Badge variant="secondary" className="bg-yellow-200 text-yellow-800 text-xs font-medium">
                            📌 Sin leer
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{timeAgo}</span>
                        </div>
                        <span>👤 {log.admin}</span>
                        <span>📧 {userEmail || `Usuario ${log.uid.substring(0, 8)}...`}</span>
                        <span className="hidden sm:inline">
                          📅 {format(new Date(log.timestamp.seconds * 1000), "dd/MM/yyyy HH:mm", {
                            locale: es,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!log.readByAdmin && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => markAsRead(log.id)}
                      className="text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 shrink-0"
                    >
                      Marcar como leída
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Resumen final */}
      {filteredLogs.length > 0 && (
        <Card className="p-4">
          <div className="text-center text-sm text-muted-foreground">
            Mostrando {filteredLogs.length} de {logs.length} notificaciones • 🟢 Actualizaciones en tiempo real
          </div>
        </Card>
      )}
    </div>
  )
}