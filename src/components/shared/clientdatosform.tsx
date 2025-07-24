"use client"

import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Copy, Phone, Folder, User } from "lucide-react"
import { toast } from "sonner"

type Cliente = {
  email: string
  name?: string
  phone?: string
  instagramUser?: string
  notas?: string
  carpetaTrabajo?: string 
}

type Props = {
  cliente: Cliente
  setCliente: React.Dispatch<React.SetStateAction<Cliente | null>>
  uid: string
  onSave: () => Promise<void>
}

export default function ClienteDatosForm({ cliente, setCliente, onSave }: Props) {
  
  if (!cliente) return null

  const copiarEmail = () => {
    navigator.clipboard.writeText(cliente.email)
    toast.success("Correo copiado")
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">📝 Datos del Cliente</h2>

      <div>
        <div className="flex items-center gap-2">
          <Image
            src="/gmail-icon-bw.svg"
            alt="Gmail logo"
            width={24}
            height={24}
            className="rounded object-contain"
          />
          <Input
            value={cliente.email}
            readOnly
            type="email"
            className="bg-muted cursor-not-allowed"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={copiarEmail}
            title="Copiar email"
          >
            <Copy size={16} />
          </Button>
        </div>
      </div>

      {/* Nombre con icono User */}
      <div className="flex items-center gap-2">
        <User size={24} />
        <Input
          placeholder="Nombre"
          value={cliente.name || ""}
          onChange={(e) =>
            setCliente((prev) => prev && { ...prev, name: e.target.value })
          }
        />
      </div>

      {/* Teléfono con icono */}
      <div className="flex items-center gap-2">
        <Phone size={24} />
        <Input
          placeholder="Teléfono"
          value={cliente.phone || ""}
          onChange={(e) =>
            setCliente((prev) => prev && { ...prev, phone: e.target.value })
          }
        />
      </div>

      {/* Instagram con logo redondo */}
      <div className="flex items-center gap-2">
        <Image
          src="/instagram-icon.svg"
          alt="Instagram logo"
          width={24}
          height={24}
          className="rounded-full object-cover"
        />
        <Input
          placeholder="Instagram"
          value={cliente.instagramUser || ""}
          onChange={(e) =>
            setCliente((prev) => prev && { ...prev, instagramUser: e.target.value })
          }
        />
      </div>

      {/* Carpeta de trabajo con icono */}
      <div className="flex items-center gap-2">
        <Folder size={24} />
        <Input
          placeholder="Enlace a carpeta de trabajo"
          type="url"
          value={cliente.carpetaTrabajo || ""}
          onChange={(e) =>
            setCliente((prev) => prev && { ...prev, carpetaTrabajo: e.target.value })
          }
        />
      </div>

      <Textarea
        placeholder="Notas internas"
        value={cliente.notas || ""}
        onChange={(e) =>
          setCliente((prev) => prev && { ...prev, notas: e.target.value })
        }
      />

      <Button onClick={onSave}>Guardar Cambios</Button>
    </div>
  )
}
