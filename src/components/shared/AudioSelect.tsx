"use client";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface AudioItem {
  id: string;
  name?: string;
}

interface AudioSelectProps {
  audios: AudioItem[];
  onChange: (value: string) => void;
}

export function AudioSelect({ audios, onChange }: AudioSelectProps) {
  return (
    <div>
      <p className="mb-1">Selecciona audio</p>
      <Select onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Elige un audio" />
        </SelectTrigger>
        <SelectContent>
          {audios.length > 0 ? (
            audios.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              No tienes audios disponibles
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

