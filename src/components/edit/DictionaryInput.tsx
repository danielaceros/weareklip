"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function DictionaryInput({ value, onChange }: Props) {
  return (
    <div>
      <Label>Diccionario (palabras separadas por comas)</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej: Submagic, IA, captions"
      />
    </div>
  );
}
