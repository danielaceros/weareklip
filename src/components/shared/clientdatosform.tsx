"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

type Cliente = {
  email: string
  name?: string
  phone?: string
  instagramUser?: string
  notas?: string
}

type Props = {
  cliente: Cliente
  setCliente: React.Dispatch<React.SetStateAction<Cliente | null>>
  uid: string
  onSave: () => Promise<void>
}

export default function ClienteDatosForm({ cliente, setCliente, onSave }: Props) {
  if (!cliente) return null

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">📝 Datos del Cliente</h2>

      <Input
        placeholder="Nombre"
        value={cliente.name || ""}
        onChange={(e) => setCliente((prev) => prev && ({ ...prev, name: e.target.value }))}
      />

      <Input
        placeholder="Email"
        value={cliente.email || ""}
        onChange={(e) => setCliente((prev) => prev && ({ ...prev, email: e.target.value }))}
      />

      <Input
        placeholder="Teléfono"
        value={cliente.phone || ""}
        onChange={(e) => setCliente((prev) => prev && ({ ...prev, phone: e.target.value }))}
      />

      <Input
        placeholder="Instagram"
        value={cliente.instagramUser || ""}
        onChange={(e) => setCliente((prev) => prev && ({ ...prev, instagramUser: e.target.value }))}
      />

      <Textarea
        placeholder="Notas internas"
        value={cliente.notas || ""}
        onChange={(e) => setCliente((prev) => prev && ({ ...prev, notas: e.target.value }))}
      />

      <Button onClick={onSave}>Guardar Cambios</Button>
    </div>
  )
}
