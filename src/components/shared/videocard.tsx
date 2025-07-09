"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import React from "react"

interface VideoCardProps {
  titulo: string
  url: string
  estado: number
  onClick: () => void
}

const estados: Record<number, React.ReactNode> = {
  0: <Badge className="bg-red-500 text-white">🆕 Nuevo</Badge>,
  1: <Badge className="bg-yellow-400 text-black">✏️ Cambios</Badge>,
  2: <Badge className="bg-green-500 text-white">✅ Aprobado</Badge>,
}

export default function VideoCard({
  titulo,
  url,
  estado,
  onClick,
}: VideoCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition max-w-[180px] w-full"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Editar vídeo ${titulo}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick()
      }}
    >
      <CardContent className="p-2 space-y-1">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-base truncate max-w-[120px]">{titulo}</h2>
          {estados[estado] ?? <Badge variant="secondary">Desconocido</Badge>}
        </div>
        <video
          src={url}
          className="w-full h-[320px] rounded object-cover mt-2"
          controls
          preload="metadata"
          aria-label={`Vídeo de ${titulo}`}
        />
      </CardContent>
    </Card>
  )
}
