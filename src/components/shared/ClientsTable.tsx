// src/components/shared/clientstable.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

type Cliente = {
  uid: string;
  email: string;
  name?: string;
  estado?: string;
  notas?: string;
  subStatus?: string;
  planName?: string;
  createdAt?: number;
  startDate?: number | null;
  endDate?: number | null;
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
  const t = useT();

  const COL_NAME = t("admin.clients.table.name");
  const COL_EMAIL = t("admin.clients.table.email");
  const COL_STATUS = t("admin.clients.table.status");
  const COL_PLAN = t("admin.clients.table.plan");
  const COL_SUBSCRIPTION = t("admin.clients.table.subscription");
  const COL_SUB_END = t("admin.clients.table.subEnd");
  const COL_NOTES = t("clientForm.labels.internalNotes");

  const LABEL_LOAD_MORE = t("admin.clients.table.loadMore");
  const LABEL_LOADING = t("admin.clients.table.loading");
  const LABEL_EMPTY = t("admin.clients.empty");

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-sm overflow-hidden",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm text-foreground"
          role="table"
          aria-label={t("admin.clients.title")}
        >
          <thead className="bg-muted/60 border-b border-border">
            <tr>
              <Th scope="col">{COL_NAME}</Th>
              <Th scope="col">{COL_EMAIL}</Th>
              <Th scope="col" className="w-[260px]">
                {COL_STATUS}
              </Th>
              <Th scope="col">{COL_PLAN}</Th>
              <Th scope="col" className="whitespace-nowrap">
                {COL_SUBSCRIPTION}
              </Th>
              <Th scope="col" className="w-[180px]">
                {COL_SUB_END}
              </Th>
              <Th scope="col" className="w-[280px]">
                {COL_NOTES}
              </Th>
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
                <Td className="whitespace-nowrap font-medium">
                  {c.name?.trim() || "—"}
                </Td>

                <Td className="whitespace-nowrap text-muted-foreground">
                  {c.email}
                </Td>

                <Td onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-block w-2.5 h-2.5 rounded-full",
                        isActive(c.subStatus || "")
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40"
                      )}
                      aria-hidden="true"
                    />
                    <select
                      className={cn(
                        "w-full rounded-md px-2 py-1",
                        "bg-card text-foreground border border-border",
                        "focus:outline-none focus:ring-2 focus:ring-primary/40"
                      )}
                      aria-label={COL_STATUS}
                      value={c.estado || "Nuevo Cliente"}
                      onChange={(e) => onChange(c.uid, "estado", e.target.value)}
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
                  {c.planName || "—"}
                </Td>

                <Td className="whitespace-nowrap text-muted-foreground">
                  {formatDateSafe(c.startDate ?? c.createdAt)}
                </Td>

                <Td className="whitespace-nowrap text-muted-foreground">
                  {formatDateSafe(c.endDate)}
                </Td>

                <Td onClick={(e) => e.stopPropagation()}>
                  <input
                    className={cn(
                      "w-full rounded-md px-2 py-1",
                      "bg-card text-foreground border border-border",
                      "placeholder:text-muted-foreground/70",
                      "focus:outline-none focus:ring-2 focus:ring-primary/40"
                    )}
                    aria-label={COL_NOTES}
                    value={c.notas || ""}
                    placeholder="—"
                    onChange={(e) => onChange(c.uid, "notas", e.target.value)}
                  />
                </Td>
              </tr>
            ))}

            {clients.length === 0 && (
              <tr>
                <Td
                  colSpan={7}
                  className="text-center py-10 text-muted-foreground"
                >
                  {LABEL_EMPTY}
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
            aria-label={LABEL_LOAD_MORE}
            className="bg-accent text-accent-foreground hover:bg-accent/80"
          >
            {loadingMore ? LABEL_LOADING : LABEL_LOAD_MORE}
          </Button>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className,
  scope,
}: React.PropsWithChildren<{ className?: string; scope?: "col" | "row" }>) {
  return (
    <th
      scope={scope}
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

function formatDateSafe(v?: number | null) {
  if (!v) return "—";
  const ms = v < 1e12 ? v * 1000 : v;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

