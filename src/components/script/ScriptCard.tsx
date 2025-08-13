"use client";

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import Image from "next/image";

interface ScriptCardProps {
  script: ScriptData;
  onView: () => void;
  onDelete: () => void;
}

interface ScriptData {
  scriptId: string;
  isAI?: boolean;
  ctaText?: string;
  platform?: string;
  addCTA?: boolean;
  structure?: string;
  tone?: string;
  duration?: string;
  language?: string;
  description?: string;
  script?: string;
  rating?: number;
  createdAt?: { seconds: number; nanoseconds: number };
  fuente?: string;
  videoTitle?: string;
  videoDescription?: string;
  videoChannel?: string;
  videoPublishedAt?: string;
  videoViews?: number;
  videoThumbnail?: string;
}

export function ScriptCard({ script, onView, onDelete }: ScriptCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 flex justify-between items-center">
        <div>
          {script.isAI ? (
            <>
              <h3 className="text-sm font-bold truncate">{script.description || "Sin título"}</h3>
              <div className="flex gap-1 mt-1">
                <Badge variant="outline">{script.platform}</Badge>
                <Badge variant="outline">{script.duration}</Badge>
                <Badge variant="outline">{script.structure}</Badge>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold truncate">{script.videoTitle || "Video replicado"}</h3>
              <p className="text-xs text-gray-500 truncate">
                {script.videoChannel} • {script.videoViews?.toLocaleString()} views
              </p>
            </>
          )}
        </div>
        {script.isAI && <Badge>⭐ {script.rating || 0}</Badge>}
      </CardHeader>

      <CardContent className="p-3">
        {script.isAI ? (
          <p className="text-xs text-gray-600 line-clamp-5">{script.script || "Sin contenido"}</p>
        ) : (
          <>
            {script.videoThumbnail && (
              <Image
                src={script.videoThumbnail}
                alt={script.videoTitle || ""}
                width={400}
                height={225}
                className="rounded mb-2"
              />
            )}
            <p className="text-xs text-gray-600 line-clamp-5">{script.script || "Sin contenido"}</p>
          </>
        )}
      </CardContent>

      <CardFooter className="p-3 flex justify-between items-center">
        <Button size="sm" variant="secondary" onClick={onView}>
          Ver
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 size={14} />
        </Button>
      </CardFooter>
    </Card>
  );
}
