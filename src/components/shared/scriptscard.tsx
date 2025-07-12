"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import React from "react";

interface ScriptCardProps {
  titulo: string;
  contenido: string;
  estado: number;
  onClick: () => void;
  onDelete?: () => void; // 👈 Añadida esta prop opcional
}

const estados: Record<number, React.ReactNode> = {
  0: <Badge className="bg-red-500 text-white">🆕 Nuevo</Badge>,
  1: <Badge className="bg-yellow-400 text-black">✏️ Cambios</Badge>,
  2: <Badge className="bg-green-500 text-white">✅ Aprobado</Badge>,
};

export default function ScriptCard({
  titulo,
  contenido,
  estado,
  onClick,
  onDelete,
}: ScriptCardProps) {
  return (
    <Card
      className="relative cursor-pointer hover:shadow-lg transition"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Editar guion ${titulo}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <h2 className="font-semibold text-lg truncate">{titulo}</h2>
            {estados[estado] ?? <Badge variant="secondary">Desconocido</Badge>}
          </div>

          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation(); // ❌ Previene que se dispare onClick del card
                onDelete();
              }}
              aria-label="Eliminar guion"
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
  );
}
