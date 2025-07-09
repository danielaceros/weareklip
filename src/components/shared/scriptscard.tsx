"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import React from "react"

interface ScriptCardProps {
  titulo: string
  contenido: string
  estado: number
  onClick: () => void
}

const estados: Record<number, React.ReactNode> = {
  0: <Badge className="bg-red-500 text-white">🆕 Nuevo</Badge>,
  1: <Badge className="bg-yellow-400 text-black">✏️ Cambios</Badge>,
  2: <Badge className="bg-green-500 text-white">✅ Aprobado</Badge>,
}

export default function ScriptCard({
  titulo,
  contenido,
  estado,
  onClick,
}: ScriptCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Editar guion ${titulo}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick()
      }}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg truncate">{titulo}</h2>
          {estados[estado] ?? <Badge variant="secondary">Desconocido</Badge>}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">
          {contenido}
        </p>
      </CardContent>
    </Card>
  )
}
