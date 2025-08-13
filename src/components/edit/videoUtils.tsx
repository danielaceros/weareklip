"use client";

import { Badge } from "@/components/ui/badge";

export const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-500 hover:bg-green-600">Completado</Badge>;
    case "processing":
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Procesando</Badge>;
    case "error":
      return <Badge className="bg-red-500 hover:bg-red-600">Error</Badge>;
    default:
      return <Badge className="bg-gray-500">Desconocido</Badge>;
  }
};
