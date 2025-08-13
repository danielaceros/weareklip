"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VoiceCardProps {
  voiceId: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
}

export function VoiceCard({ name, category, description, preview_url }: VoiceCardProps) {
  return (
    <Card className="p-3">
      <CardHeader>
        <h3 className="font-bold">{name || "Sin nombre"}</h3>
        {category && <Badge variant="outline">{category}</Badge>}
      </CardHeader>
      <CardContent>
        {description && <p className="text-sm mb-2">{description}</p>}
        {preview_url ? (
          <audio controls src={preview_url} className="w-full" />
        ) : (
          <p className="text-xs text-gray-500">Sin preview disponible</p>
        )}
      </CardContent>
    </Card>
  );
}
