// components/client/GuionesSection.tsx

"use client"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Guion = {
  firebaseId: string
  titulo: string
  contenido: string
  estado: number
}

type Props = {
  guiones: Guion[]
  setModalOpen: (open: boolean) => void
  onCreate: (titulo: string, contenido: string) => void
  onSelect: (guion: Guion) => void
  modalOpen: boolean
}

export default function GuionesSection({
  guiones,
  onCreate,
  onSelect,
  modalOpen,
  setModalOpen,
}: Props) {
  const [titulo, setTitulo] = useState("")
  const [contenido, setContenido] = useState("")

  const handleSubmit = () => {
    onCreate(titulo, contenido)
    setTitulo("")
    setContenido("")
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold">📜 Guiones</h2>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button>+ Crear</Button>
          </DialogTrigger>
          <DialogContent>
            <h3 className="font-semibold text-lg mb-2">Nuevo Guion</h3>
            <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            <Textarea placeholder="Contenido" value={contenido} onChange={(e) => setContenido(e.target.value)} />
            <Button onClick={handleSubmit} className="mt-2">Guardar</Button>
          </DialogContent>
        </Dialog>
      </div>

      {guiones.length === 0 ? (
        <p className="text-muted-foreground">Este cliente no tiene guiones aún.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {guiones.map((g) => (
            <Card key={g.firebaseId} className="p-3 cursor-pointer" onClick={() => onSelect(g)}>
              <p className="font-semibold text-base">{g.titulo}</p>
              <p className="text-muted-foreground whitespace-pre-line">{g.contenido}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
