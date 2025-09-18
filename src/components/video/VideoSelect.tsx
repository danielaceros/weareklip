// src/components/video/VideoSelect.tsx
"use client";

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

  const hasVideos = videos && videos.length > 0;

  return (
    <div>
      <p className="mb-1">{t("userPage.clonacion.select.label")}</p>
      <Select onValueChange={onChange} disabled={!hasVideos}>
        <SelectTrigger>
          <SelectValue placeholder={t("userPage.clonacion.select.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {hasVideos ? (
            videos.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name ?? t("videos.untitled")}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              {t("userPage.clonacion.select.empty")}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
