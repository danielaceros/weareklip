"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LanguageOption = { name: string; code: string };

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function LanguageSelect({ value, onChange }: Props) {
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/submagic/languages")
      .then((res) => res.json())
      .then((data) => setLanguages(data.languages || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Label>Idioma</Label>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin h-4 w-4" /> Cargando idiomas...
        </div>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un idioma" />
          </SelectTrigger>
          <SelectContent>
            {languages.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.name} ({l.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
