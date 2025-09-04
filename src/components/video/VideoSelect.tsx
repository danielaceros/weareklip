"use client";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface VideoItem {
  id: string;
  name?: string;
}

interface VideoSelectProps {
  videos: VideoItem[];
  onChange: (value: string) => void;
}

export function VideoSelect({ videos, onChange }: VideoSelectProps) {
  return (
    <div>
      <p className="mb-1">Selecciona vídeo de clonación</p>
      <Select onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Elige un vídeo" />
        </SelectTrigger>
        <SelectContent>
          {videos.length > 0 ? (
            videos.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              No tienes vídeos de clonación
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

