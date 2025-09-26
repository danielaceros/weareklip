// src/components/voice/VoiceCard.tsx
"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

interface VoiceCardProps {
  voiceId: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
}

export function VoiceCard({ name, category, description, preview_url }: VoiceCardProps) {
  const t = useT();

  return (
    <Card className="p-3">
      <CardHeader>
        <h3 className="font-bold">{name || t("voices.card.untitled")}</h3>
        {category && <Badge variant="outline">{category}</Badge>}
      </CardHeader>
      <CardContent>
        {description && <p className="text-sm mb-2">{description}</p>}
        {preview_url ? (
          <audio controls src={preview_url} className="w-full" />
        ) : (
          <p className="text-xs text-gray-500">{t("voices.card.previewUnavailable")}</p>
        )}
      </CardContent>
    </Card>
  );
}
