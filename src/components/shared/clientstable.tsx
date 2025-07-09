"use client"

import { Card, CardContent } from "@/components/ui/card"

type ClienteCompleto = {
  uid: string
  email: string
  name?: string
  estado?: string
  notas?: string
  subStatus?: string
  planName?: string
  createdAt?: number
}

type Props = {
  clients: ClienteCompleto[]
  isActive: (status: string) => boolean
  onChange: (uid: string, field: "estado" | "notas", value: string) => void
  onRowClick: (uid: string) => void
  onLoadMore: () => void
  hasMore: boolean
  loadingMore: boolean
}

export default function ClientsTable({
  clients,
  isActive,
  onChange,
  onRowClick,
  onLoadMore,
  hasMore,
  loadingMore,
}: Props) {
  return (
    <Card>
      <CardContent className="p-6 overflow-x-auto">
        <table className="w-full text-sm text-gray-700 border rounded-xl shadow-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Pack</th>
              <th className="px-4 py-3">Subscripción</th>
              <th className="px-4 py-3">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {clients
              .filter((client) => isActive(client.subStatus || ""))
              .map((client) => (
                <tr
                  key={client.uid}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onRowClick(client.uid)}
                >
                  <td className="px-4 py-3">{client.name || "-"}</td>
                  <td className="px-4 py-3">{client.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={client.estado || ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onChange(client.uid, "estado", e.target.value)}
                      className="w-full border rounded px-2 py-1"
                    >
                      <option value="">🟡 Sin estado</option>
                      <option value="Nuevo Cliente">🆕 Nuevo Cliente</option>
                      <option value="Onboarding">🚀 Onboarding</option>
                      <option value="Enviar Vídeo Dani">🎥 Enviar Vídeo Dani</option>
                      <option value="Generar Guión">✍️ Generar Guión</option>
                      <option value="Esperando Confirmación Guión">⏳ Confirmación Guión</option>
                      <option value="Esperando Clonación">🧬 Esperando Clonación</option>
                      <option value="Generar Vídeo">🎬 Generar Vídeo</option>
                      <option value="Enviado a Editor">🛠️ Enviado a Editor</option>
                      <option value="Revisar Vídeo">🔍 Revisar Vídeo</option>
                      <option value="Programado">📅 Programado</option>
                      <option value="Finalizado">✅ Finalizado</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">{client.planName || "-"}</td>
                  <td className="px-4 py-3">
                    {client.createdAt
                      ? new Date(client.createdAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={client.notas || ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onChange(client.uid, "notas", e.target.value)}
                      className="w-full border rounded px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              {loadingMore ? "Cargando..." : "Cargar más"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
