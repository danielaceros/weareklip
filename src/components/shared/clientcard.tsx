"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

type Props = {
  uid: string
  email: string
  name?: string
  planName?: string
  createdAt?: number
}

export default function ClienteCard({ uid, email, name, planName, createdAt }: Props) {
  const router = useRouter()

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-lg transition-all border border-gray-200"
      onClick={() => router.push(`/admin/client/${uid}`)}
    >
      <p className="text-lg font-semibold">{email}</p>
      <p className="text-sm text-muted-foreground">{name || "Sin nombre"}</p>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">{planName || "Sin plan"}</Badge>
        <Badge variant="default">
          {createdAt ? format(new Date(createdAt), "dd/MM/yyyy") : "Sin fecha"}
        </Badge>
      </div>
    </Card>
  )
}
