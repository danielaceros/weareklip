"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

interface Props {
  magicZooms: boolean;
  setMagicZooms: (value: boolean) => void;
  magicBrolls: boolean;
  setMagicBrolls: (value: boolean) => void;
  magicBrollsPercentage: number;
  setMagicBrollsPercentage: (value: number) => void;
}

export function MagicOptions({
  magicZooms,
  setMagicZooms,
  magicBrolls,
  setMagicBrolls,
  magicBrollsPercentage,
  setMagicBrollsPercentage
}: Props) {
  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex items-center space-x-2">
          <Checkbox checked={magicZooms} onCheckedChange={(c) => setMagicZooms(!!c)} />
          <Label>Magic Zooms</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox checked={magicBrolls} onCheckedChange={(c) => setMagicBrolls(!!c)} />
          <Label>Magic B-rolls</Label>
        </div>
      </div>

      {magicBrolls && (
        <div>
          <Label>Porcentaje de B-rolls: {magicBrollsPercentage}%</Label>
          <Slider
            defaultValue={[magicBrollsPercentage]}
            max={100}
            step={1}
            onValueChange={(v) => setMagicBrollsPercentage(v[0])}
          />
        </div>
      )}
    </>
  );
}
