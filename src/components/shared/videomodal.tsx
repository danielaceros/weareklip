"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VideoEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  url: string;
  estado: string;
  notas: string;
  onNotasChange: (val: string) => void;
  onTituloChange: (val: string) => void;
  onEstadoChange: (val: string) => void;
  onDownload: () => Promise<void>;
  onGuardar: () => Promise<void>;
}

export default function VideoEditorModal({
  open,
  onOpenChange,
  titulo,
  url,
  estado,
  notas,
  onNotasChange,
  onTituloChange,
  onEstadoChange,
  onDownload,
  onGuardar,
}: VideoEditorModalProps) {
  const showCorrecciones = estado === "1"; // Mostrar textarea solo si estado = Necesita Cambios

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <Input
              type="text"
              value={titulo}
              onChange={(e) => onTituloChange(e.target.value)}
              placeholder="Título del vídeo"
              aria-label="Editar título del vídeo"
              className="text-lg font-semibold"
            />
          </DialogTitle>
        </DialogHeader>

        <video
          src={url}
          controls
          className="w-full max-h-[400px] rounded mb-4 object-contain"
          preload="metadata"
          aria-label={`Previsualización del vídeo ${titulo}`}
        />

        <div className="flex items-center gap-4 mb-4">
          <Select value={estado} onValueChange={onEstadoChange}>
            <SelectTrigger aria-label="Selecciona estado" className="w-48">
              <SelectValue placeholder="Selecciona estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">🆕 Nuevo</SelectItem>
              <SelectItem value="1">✏️ Necesita Cambios</SelectItem>
              <SelectItem value="2">✅ Aprobado</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={onDownload}>Descargar vídeo</Button>
        </div>

        {showCorrecciones && (
          <div className="mb-4">
            <label htmlFor="notas" className="block font-medium mb-1">
              Correcciones
            </label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => onNotasChange(e.target.value)}
              placeholder="Agrega correcciones para el administrador"
              rows={4}
            />
          </div>
        )}

        <Button className="w-full" onClick={onGuardar}>
          Guardar cambios
        </Button>
      </DialogContent>
    </Dialog>
  );
}
