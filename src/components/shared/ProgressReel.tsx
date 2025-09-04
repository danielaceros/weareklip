// src/components/shared/ProgressReel.tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox, FileCheck2, Mic2, Clapperboard, CheckCircle2 } from "lucide-react";
import type { ReelEstado } from "@/types/video";

const STEPS: Array<{ key: ReelEstado; label: string; Icon: LucideIcon }> = [
  { key: "Recibido",       label: "Recibido",       Icon: Inbox },
  { key: "Guión aprobado", label: "Guión aprobado", Icon: FileCheck2 },
  { key: "Voz generada",   label: "Voz generada",   Icon: Mic2 },
  { key: "Vídeo creado",   label: "Vídeo creado",   Icon: Clapperboard },
  { key: "Entregado",      label: "Entregado",      Icon: CheckCircle2 },
];

// Normaliza cualquier entrada a un ReelEstado válido
function normalizeEstado(value?: ReelEstado | null): ReelEstado {
  const v = (value || "Recibido").toLowerCase();
  if (v.includes("recib")) return "Recibido";
  if (v.includes("aprob")) return "Guión aprobado";
  if (v.includes("voz")) return "Voz generada";
  if (v.includes("vídeo") || v.includes("video")) return "Vídeo creado";
  if (v.includes("entreg")) return "Entregado";
  return "Recibido";
}

type Size = "normal" | "narrow";

export function ProgressReel({
  estado,
  compact = false,
  size = "normal",
  className = "",
}: {
  estado?: ReelEstado | null;
  compact?: boolean; // en tarjetas: solo iconos
  size?: Size;       // en modal: "narrow" para chips más compactos
  className?: string;
}) {
  const current = normalizeEstado(estado);
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === current));

  // Espaciados/medidas seguras para evitar desbordes
  const outerGap = compact ? "gap-2" : size === "narrow" ? "gap-2" : "gap-3";
  const innerGap = compact ? "gap-2" : size === "narrow" ? "gap-2" : "gap-2";
  const pad = compact ? "px-2 py-1" : size === "narrow" ? "px-2.5 py-1.5" : "px-3 py-2";
  const chipH = compact ? "h-7" : "h-8";
  const icon = compact ? "h-4 w-4" : size === "narrow" ? "h-4 w-4" : "h-4 w-4";
  const text = size === "narrow" ? "text-xs" : "text-sm";
  const connectorW = compact ? "w-4" : size === "narrow" ? "w-5" : "w-6";

  const chipBase =
    `inline-flex items-center ${innerGap} rounded-xl border ${pad} ${chipH} ` +
    `overflow-hidden leading-none whitespace-nowrap`;

  return (
    <div className={`w-full ${className}`}>
      <ol className={`flex items-center ${outerGap}`} role="list" aria-label="Progreso del reel">
        {STEPS.map((step, i) => {
          const done = i <= idx;
          const isCurrent = i === idx;
          return (
            <li
              key={step.key}
              role="listitem"
              aria-current={isCurrent ? "step" : undefined}
              className="flex items-center"
            >
              <div
                className={`${chipBase} ${
                  done ? "border-[--ring] bg-[--accent]/10" : "border-transparent bg-muted/40"
                }`}
                title={step.label}
              >
                <step.Icon
                  className={`${icon} flex-shrink-0 ${done ? "text-[--accent]" : "text-foreground/60"}`}
                  aria-hidden="true"
                />
                {!compact && (
                  <span className={`${text} ${done ? "text-foreground" : "text-foreground/70"}`}>
                    {step.label}
                  </span>
                )}
              </div>

              {i < STEPS.length - 1 && (
                <div
                  className={`h-[2px] ${connectorW} rounded-full ${
                    i < idx ? "bg-[--accent]" : "bg-foreground/20"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      {!compact && (
        <p className="mt-2 text-xs text-foreground/60">
          Estado actual: <strong>{STEPS[idx]?.label}</strong>
        </p>
      )}
    </div>
  );
}

