"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import React from "react"
import { useTranslations } from "next-intl"

interface ScriptCardProps {
  titulo: string
  contenido: string
  estado: number
  onClick: () => void
  onDelete?: () => void
}

export default function ScriptCard({
  titulo,
  contenido,
  estado,
  onClick,
  onDelete,
}: ScriptCardProps) {
  const tStatus = useTranslations("status")
  const tCommon = useTranslations("common")

  const renderEstado = (value: number) => {
    switch (value) {
      case 0:
        return <Badge className="bg-red-500 text-white">{tStatus("new")}</Badge>
      case 1:
        return (
          <Badge className="bg-yellow-400 text-black">
            {tStatus("changes")}
          </Badge>
        )
      case 2:
        return (
          <Badge className="bg-green-500 text-white">
            {tStatus("approved")}
          </Badge>
        )
      default:
        return <Badge variant="secondary">{tCommon("unknown")}</Badge>
    }
  }

  return (
    <Card
      className="relative cursor-pointer hover:shadow-lg transition"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={titulo}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick()
      }}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <h2 className="font-semibold text-lg truncate">{titulo}</h2>
            {renderEstado(estado)}
          </div>

          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label="Delete script"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">
          {contenido}
        </p>
      </CardContent>
    </Card>
  )
}

