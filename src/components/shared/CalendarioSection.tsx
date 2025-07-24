"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, addDoc, getDocs, Timestamp } from "firebase/firestore"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

type Evento = {
  id: string
  tipo: "guion" | "video"
  titulo: string
  fecha: string
}

type Item = {
  firebaseId: string
  titulo: string
}

type Props = {
  uid: string
  guiones: Item[]
  videos: Item[]
}

export default function CalendarioSection({ uid, guiones, videos }: Props) {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tipo, setTipo] = useState<"guion" | "video">("guion")
  const [itemId, setItemId] = useState("")
  const [fecha, setFecha] = useState("")

  const fetchEventos = async () => {
    const snap = await getDocs(collection(db, "users", uid, "calendario"))
    const data = snap.docs.map(doc => {
      const d = doc.data()
      return {
        id: doc.id,
        tipo: d.tipo,
        titulo: d.titulo,
        fecha: d.fecha.toDate().toISOString().split("T")[0],
      }
    })
    setEventos(data)
  }

  useEffect(() => {
    fetchEventos()
  }, [uid])

  const handleAgregar = async () => {
    if (!itemId || !fecha) return

    const fuente = tipo === "guion" ? guiones : videos
    const item = fuente.find(i => i.firebaseId === itemId)

    await addDoc(collection(db, "users", uid, "calendario"), {
      tipo,
      refId: itemId,
      titulo: item?.titulo || "",
      fecha: Timestamp.fromDate(new Date(fecha))
    })

    setItemId("")
    setFecha("")
    fetchEventos()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">📅 Calendario de Publicación</h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {eventos.map((e) => (
          <Card key={e.id} className="p-3">
            <p className="text-sm text-muted-foreground">{e.tipo === "guion" ? "📜 Guion" : "🎬 Video"}</p>
            <p className="font-semibold">{e.titulo}</p>
            <p className="text-sm">🗓 {e.fecha}</p>
          </Card>
        ))}
      </div>

      <div className="border-t pt-4 space-y-2">
        <h3 className="text-lg font-semibold">➕ Añadir evento</h3>

        <div className="flex flex-col md:flex-row gap-2">
          <Select value={tipo} onValueChange={(v) => setTipo(v as "guion" | "video")}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="guion">Guion</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>

          <select
            className="border rounded px-2 py-2 text-sm w-full"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="">Seleccionar {tipo}</option>
            {(tipo === "guion" ? guiones : videos).map((i) => (
              <option key={i.firebaseId} value={i.firebaseId}>
                {i.titulo}
              </option>
            ))}
          </select>

          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Button onClick={handleAgregar}>Agregar</Button>
        </div>
      </div>
    </div>
  )
}
