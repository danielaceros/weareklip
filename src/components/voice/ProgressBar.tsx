// src/components/voice/ProgressBar.tsx
"use client";

import { useT } from "@/lib/i18n";

const MAX_SECONDS = 180;

export function ProgressBar({ totalDuration }: { totalDuration: number }) {
  const t = useT();

  const percent = Math.min((totalDuration / MAX_SECONDS) * 100, 100);
  const color = totalDuration < 120 ? "bg-green-500" : "bg-yellow-500";

  return (
    <div className="mt-6">
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`${color} h-4`}
          style={{ width: `${percent}%`, transition: "width 0.3s ease" }}
        />
      </div>
      <p className="text-xs mt-2 text-gray-500">
        {t("voices.samples.progressLabel", {
          seconds: Math.floor(totalDuration),
          max: MAX_SECONDS,
        })}
      </p>
    </div>
  );
}
