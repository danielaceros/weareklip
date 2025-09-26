"use client";

import { useId } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useT } from "@/lib/i18n";

interface VideoItem {
  id: string;
  name?: string;
}

interface VideoSelectProps {
  videos: VideoItem[];
  onChange: (value: string) => void;
}

export function VideoSelect({ videos, onChange }: VideoSelectProps) {
  const t = useT();
  const labelId = useId();

  return (
    <div>
      <p id={labelId} className="mb-1 text-sm font-medium">
        {t("video.select.label")}
      </p>
      <Select onValueChange={onChange} aria-labelledby={labelId}>
        <SelectTrigger>
          <SelectValue placeholder={t("video.select.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {videos.length > 0 ? (
            videos.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name || t("video.select.unnamed")}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              {t("video.select.empty")}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
