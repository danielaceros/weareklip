"use client";

import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

export interface AudioData {
  audioId: string;
  name?: string;
  description?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  url: string;
  duration?: string;
  language?: string;
}

interface AudiosListProps {
  audios: AudioData[];
  onDelete: (audioId: string) => void;
}

export function AudiosList({ audios, onDelete }: AudiosListProps) {
  if (audios.length === 0) return <p>No tienes audios aún.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {audios.map((audio) => (
        <Card key={audio.audioId} className="overflow-hidden">
          <CardHeader className="p-3 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold truncate">{audio.name || "Sin título"}</h3>
              <div className="flex gap-1 mt-1">
                {audio.language && <Badge variant="outline">{audio.language}</Badge>}
                {audio.duration && <Badge variant="outline">{audio.duration}</Badge>}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3">
            {audio.description && (
              <p className="text-xs text-gray-600 mb-2 line-clamp-3">{audio.description}</p>
            )}
            <audio controls src={audio.url} className="w-full" />
          </CardContent>

          <CardFooter className="p-3 flex justify-between items-center">
            <Button size="sm" variant="destructive" onClick={() => onDelete(audio.audioId)}>
              <Trash2 size={14} />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
