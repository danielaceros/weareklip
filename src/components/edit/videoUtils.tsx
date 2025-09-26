// src/components/shared/StatusBadge.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

function StatusBadgeInner({ status }: { status: string }) {
  const t = useT();

  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          {t("edit.card.status.completed")}
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600">
          {t("edit.card.status.processing")}
        </Badge>
      );
    case "error":
      return (
        <Badge className="bg-red-500 hover:bg-red-600">
          {t("edit.card.status.error")}
        </Badge>
      );
    default:
      return <Badge className="bg-gray-500">{t("common.unknown")}</Badge>;
  }
}

export const getStatusBadge = (status: string) => (
  <StatusBadgeInner status={status} />
);
