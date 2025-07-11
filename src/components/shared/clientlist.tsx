"use client"

import ClienteCard from "@/components/shared/clientcard"

type ClienteActivo = {
  uid: string
  email: string
  name?: string
  planName?: string
  createdAt?: number
}

type Props = {
  clientes: ClienteActivo[]
}

export default function ClienteList({ clientes }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clientes.map((client) => (
        <ClienteCard key={client.uid} {...client} />
      ))}
    </div>
  )
}
