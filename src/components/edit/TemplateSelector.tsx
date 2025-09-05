// src/app/dashboard/edit/TemplateSelector.tsx
"use client";

import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl"; // ⬅️ i18n

interface Props {
  templates: string[];
  selected: string;
  onSelect: (tpl: string) => void;
}

const BUCKET = "klip-6e9a8.firebasestorage.app";

function buildPreviewUrl(template: string) {
  const clean = template.replace(/\.mov$/i, "").toLowerCase().replaceAll(" ", "");
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/styles%2F${encodeURIComponent(
    clean
  )}.mp4?alt=media`;
}

export function TemplateSelector({ templates, selected, onSelect }: Props) {
  const t = useTranslations("templateSelector"); // ⬅️ namespace

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {templates.map((tpl, i) => {
        const previewUrl = buildPreviewUrl(tpl);

        // (nota: mantenemos estado local por item)
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(false);

        return (
          <Tooltip key={`${tpl}-${i}`}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={tpl === selected ? "default" : "secondary"}
                className="w-full"
                onClick={() => {
                  onSelect(tpl);
                  toast.success(t("toasts.templateSelected", { name: tpl }));
                }}
              >
                {tpl.replace(/\.(mov|mp4)$/i, "")}
              </Button>
            </TooltipTrigger>

            <TooltipContent className="p-0">
              {error ? (
                <div className="w-40 aspect-[9/16] flex items-center justify-center text-xs text-red-400 bg-neutral-900 rounded-md">
                  {t("preview.unavailable")}
                </div>
              ) : (
                <div className="relative w-40 aspect-[9/16] rounded-md overflow-hidden">
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                  <video
                    src={previewUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                    onCanPlay={() => setLoading(false)}
                    onError={() => {
                      setLoading(false);
                      setError(true);
                    }}
                  />
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
