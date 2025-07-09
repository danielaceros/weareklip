// components/client/EditarGuionModal.tsx

"use client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Guion = {
  firebaseId: string
  titulo: string
  contenido: string
  estado: number
}

type Props = {
  guion: Guion | null
  onClose: () => void
  onChange: (guion: Guion) => void
  onDelete: (id: string) => void
  onSave: () => void
}

export default function EditarGuionModal({
  guion,
  onClose,
  onChange,
  onDelete,
  onSave,
}: Props) {
  return (
    <Dialog open={!!guion} onOpenChange={onClose}>
      <DialogContent>
        <h3 className="text-lg font-bold mb-2">Editar Guion</h3>
        <Input
          value={guion?.titulo || ""}
          onChange={(e) =>
            guion && onChange({ ...guion, titulo: e.target.value })
          }
        />
        <Textarea
          value={guion?.contenido || ""}
          onChange={(e) =>
            guion && onChange({ ...guion, contenido: e.target.value })
          }
        />
        <div className="flex gap-2 mt-3">
          <Button
            variant="destructive"
            onClick={() => guion && onDelete(guion.firebaseId)}
          >
            Eliminar
          </Button>
          <Button onClick={onSave}>Guardar Cambios</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
