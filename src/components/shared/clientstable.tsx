"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Cliente = {
  uid: string;
  email: string;
  name?: string;
  estado?: string;
  notas?: string;
  subStatus?: string;
  planName?: string;
  createdAt?: number;
  hasBeenScheduled?: boolean;
};

type Props = {
  clients: Cliente[];
  isActive: (status: string) => boolean;
  onChange: (uid: string, field: "estado" | "notas", value: string) => void;
  onRowClick?: (uid: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  className?: string;
};

export default function ClientsTable({
  clients,
  isActive,
  onChange,
  onRowClick,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground">
          <thead className="bg-muted/60 border-b border-border">
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th className="w-[260px]">Status</Th>
              <Th>Pack</Th>
              <Th>Subscription</Th>
              <Th className="w-[280px]">Notes</Th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr
                key={c.uid}
                onClick={() => onRowClick?.(c.uid)}
                className={cn(
                  "border-b border-border/70 transition-colors",
                  "hover:bg-muted/70 cursor-pointer"
                )}
              >
                <Td className="whitespace-nowrap">
                  {c.name?.trim() || "-"}
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {c.email}
                </Td>

                {/* Estado */}
                <Td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {/* puntito activo/inactivo */}
                    <span
                      className={cn(
                        "inline-block w-2.5 h-2.5 rounded-full",
                        isActive(c.subStatus || "")
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40"
                      )}
                      aria-hidden
                    />
                    <select
                      className={cn(
                        "w-full rounded-md px-2 py-1",
                        "bg-card text-foreground border border-border",
                        "focus:outline-none focus:ring-2 focus:ring-primary/40"
                      )}
                      value={c.estado || "Nuevo Cliente"}
                      onChange={(e) =>
                        onChange(c.uid, "estado", e.target.value)
                      }
                    >
                      <option>Nuevo Cliente</option>
                      <option>Generar Guión</option>
                      <option>Esperando Confirmación Guión</option>
                      <option>Generar Vídeo</option>
                      <option>Revisar Vídeo</option>
                      <option>Programado</option>
                      <option>Finalizado</option>
                    </select>
                  </div>
                </Td>

                <Td className="whitespace-nowrap text-muted-foreground">
                  {c.planName || "-"}
                </Td>

                <Td className="whitespace-nowrap text-muted-foreground">
                  {/* pinta createdAt como rango de ejemplo si lo tenías así */}
                  {formatDateRange(c.createdAt)}
                </Td>

                {/* Notas */}
                <Td onClick={(e) => e.stopPropagation()}>
                  <input
                    className={cn(
                      "w-full rounded-md px-2 py-1",
                      "bg-card text-foreground border border-border",
                      "placeholder:text-muted-foreground/70",
                      "focus:outline-none focus:ring-2 focus:ring-primary/40"
                    )}
                    value={c.notas || ""}
                    placeholder="–"
                    onChange={(e) => onChange(c.uid, "notas", e.target.value)}
                  />
                </Td>
              </tr>
            ))}

            {clients.length === 0 && (
              <tr>
                <Td colSpan={6} className="text-center py-10 text-muted-foreground">
                  No clients
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="p-4 flex justify-center">
          <Button
            type="button"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onLoadMore?.();
            }}
            disabled={loadingMore}
            aria-busy={loadingMore}
            className="bg-accent text-accent-foreground hover:bg-accent/80"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th
      className={cn(
        "text-left font-semibold text-foreground/90 px-4 py-3",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  colSpan,
  onClick,
}: React.PropsWithChildren<{
  className?: string;
  colSpan?: number;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
}>) {
  return (
    <td
      onClick={onClick}
      colSpan={colSpan}
      className={cn("px-4 py-3 align-middle", className)}
    >
      {children}
    </td>
  );
}

function formatDateRange(createdAt?: number) {
  // si no tienes rango real, mostramos createdAt con formato corto
  if (!createdAt) return "-";
  try {
    const d = new Date(createdAt);
    return d.toLocaleDateString();
  } catch {
    return "-";
  }
}
