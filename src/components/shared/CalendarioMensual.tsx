"use client";

import { useState, useEffect, useCallback } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { es as esLocale, enUS as enLocale } from "date-fns/locale";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { handleError, showSuccess } from "@/lib/errors";
import { useLocale, useTranslations } from "next-intl";

/* ------------------------------- Tipos ------------------------------- */

type Item = {
  firebaseId: string;
  titulo: string;
  url?: string;
};

type Estado = "por_hacer" | "en_proceso" | "completado";

type Evento = {
  id: string;
  tipo: "guion" | "video";
  titulo: string;
  fecha: string; // ISO "YYYY-MM-DD"
  estado: Estado;
  refId: string;
  syncedWithMetricool?: boolean;
  metricoolId?: string;
  plataforma?: string;
  status?: string;
};

// Estructura esperada en Firestore
type CalendarDoc = {
  tipo: "guion" | "video";
  titulo: string;
  fecha: unknown; // Puede venir como Timestamp, number, string, Date...
  estado?: Estado;
  refId: string;
  syncedWithMetricool?: boolean;
  metricoolId?: string;
  plataforma?: string;
  status?: string;
};

type Props = {
  uid: string;
  guiones: Item[];
  videos: Item[];
  url?: string;
};

/* -------- helpers: fecha segura desde varios formatos (Timestamp, etc.) ------ */

type TSWithToDate = { toDate: () => Date };
type TSWithSeconds = { seconds: number; nanoseconds?: number };

function hasToDate(x: unknown): x is TSWithToDate {
  return typeof x === "object" && x !== null && "toDate" in x && typeof (x as TSWithToDate).toDate === "function";
}
function hasSeconds(x: unknown): x is TSWithSeconds {
  return typeof x === "object" && x !== null && "seconds" in x && typeof (x as TSWithSeconds).seconds === "number";
}

function toDateSafe(input: unknown): Date {
  if (input == null) return new Date(0);
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  if (typeof input === "string") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }
  if (hasToDate(input)) return input.toDate();
  if (hasSeconds(input)) return new Date(input.seconds * 1000);
  return new Date(0);
}

function formatDateToISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* ------------------------------ Componente ------------------------------ */

export default function CalendarioMensual({ uid, guiones, videos }: Props) {
  const t = useTranslations("calendarWidget");
  const localeCode = useLocale();
  const dfLocale = localeCode === "en" ? enLocale : esLocale;
  const weekdayShort =
    localeCode === "en" ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] : ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [tipo, setTipo] = useState<"guion" | "video">("guion");
  const [itemId, setItemId] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [horaEvento, setHoraEvento] = useState(""); // Hora para programación social
  const [publicarEnRedes, setPublicarEnRedes] = useState(false);
  const [metricoolIds, setMetricoolIds] = useState<{ instagramId?: string }>({});

  // Obtener providers (IDs de Instagram) al cargar
  useEffect(() => {
    fetch("/api/metricool/providers")
      .then((res) => res.json())
      .then((data) => {
        if (data.providers?.length) {
          const { instagramId } = data.providers[0];
          setMetricoolIds({ instagramId });
        }
      })
      .catch((err) => {
        // Silencioso; no bloquea UI
        console.error("Metricool providers error:", err);
      });
  }, []);

  // Resetear publicarEnRedes cuando el tipo es guion
  useEffect(() => {
    if (tipo === "guion") setPublicarEnRedes(false);
  }, [tipo]);

  // Cargar eventos
  const fetchEventos = useCallback(async () => {
    if (!uid) return;
    try {
      const snap = await getDocs(collection(db, "users", uid, "calendario"));
      const data: Evento[] = snap.docs.map((d) => {
        const raw = d.data() as CalendarDoc;
        const fechaDate = toDateSafe(raw.fecha);
        return {
          id: d.id,
          tipo: raw.tipo,
          titulo: raw.titulo,
          fecha: formatDateToISO(fechaDate),
          estado: raw.estado ?? "por_hacer",
          refId: raw.refId,
          syncedWithMetricool: raw.syncedWithMetricool ?? false,
          metricoolId: raw.metricoolId ?? "",
          plataforma: raw.plataforma ?? "",
          status: raw.status ?? "",
        };
      });
      setEventos(data);
    } catch (error) {
      handleError(error, t("errors.loadEvents"));
    }
  }, [uid, t]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  // Eliminar eventos huérfanos cuando desaparecen los guiones/vídeos
  useEffect(() => {
    const eventosAEliminar = eventos.filter((evento) => {
      const items = evento.tipo === "guion" ? guiones : videos;
      return !items.some((item) => item.firebaseId === evento.refId);
    });

    if (eventosAEliminar.length > 0) {
      const eliminarEventos = async () => {
        for (const evento of eventosAEliminar) {
          try {
            await deleteDoc(doc(db, "users", uid, "calendario", evento.id));
          } catch (error) {
            handleError(error, t("errors.deleteOrphan"));
          }
        }
        setEventos((prev) =>
          prev.filter((e) => !eventosAEliminar.some((ae) => ae.id === e.id))
        );
      };
      void eliminarEventos();
    }
  }, [guiones, videos, eventos, uid, t]);

  // Agrupar eventos por día
  type DiaInfo = {
    estado: Estado | null;
    cantidad: number;
  };
  const eventosPorDia: Record<string, DiaInfo> = {};
  eventos.forEach((evento) => {
    const fecha = evento.fecha;
    if (!eventosPorDia[fecha]) {
      eventosPorDia[fecha] = { estado: evento.estado, cantidad: 1 };
    } else {
      eventosPorDia[fecha].cantidad += 1;
      const estados = [eventosPorDia[fecha].estado, evento.estado];
      if (estados.includes("por_hacer")) {
        eventosPorDia[fecha].estado = "por_hacer";
      } else if (estados.includes("en_proceso")) {
        eventosPorDia[fecha].estado = "en_proceso";
      } else {
        eventosPorDia[fecha].estado = "completado";
      }
    }
  });

  const fechasPorHacer: Date[] = [];
  const fechasEnProceso: Date[] = [];
  const fechasCompletado: Date[] = [];
  Object.entries(eventosPorDia).forEach(([fechaISO, info]) => {
    const [year, month, day] = fechaISO.split("-").map(Number);
    const fecha = new Date(year, month - 1, day);
    if (info.estado === "por_hacer") fechasPorHacer.push(fecha);
    else if (info.estado === "en_proceso") fechasEnProceso.push(fecha);
    else if (info.estado === "completado") fechasCompletado.push(fecha);
  });

  const eventosDelDia = selected
    ? eventos.filter((e) => e.fecha === formatDateToISO(selected))
    : [];

  const handleAgregar = async () => {
    if (!itemId || !fechaEvento) {
      handleError(null, t("alerts.selectItemAndDate"));
      return;
    }

    const fuente = tipo === "guion" ? guiones : videos;
    const item = fuente.find((i) => i.firebaseId === itemId);

    if (!item) {
      handleError(null, t("alerts.itemNotFound"));
      return;
    }

    try {
      const newDoc = await addDoc(collection(db, "users", uid, "calendario"), {
        tipo,
        refId: itemId,
        titulo: item.titulo,
        fecha: Timestamp.fromDate(new Date(fechaEvento)),
        estado: "por_hacer" as Estado,
      });

      // SOLO PARA VIDEOS
      if (publicarEnRedes && tipo === "video") {
        try {
          const videoUrl = item.url || "";
          const isoDateTime = `${fechaEvento}T${horaEvento || "00:00"}:00`;

          const response = await fetch("/api/metricool/create-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid,
              calendarId: newDoc.id,
              text: item.titulo,
              date: isoDateTime,
              network: "instagram",
              imageUrl: videoUrl,
              accountId: metricoolIds.instagramId,
            }),
          });

          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Metricool error");

          await updateDoc(doc(db, "users", uid, "calendario", newDoc.id), {
            syncedWithMetricool: true,
            metricoolId: data.metricoolId,
            plataforma: "instagram",
            status: "programado",
          });

          showSuccess(t("success.addedAndScheduled"));
        } catch (err) {
          handleError(err, t("errors.syncMetricool"));
        }
      } else {
        showSuccess(t("success.added"));
      }

      setItemId("");
      setFechaEvento("");
      setHoraEvento("");
      setPublicarEnRedes(false);
      fetchEventos();
    } catch (error) {
      handleError(error, t("errors.create"));
    }
  };

  const handleEliminarEvento = async (eventoId: string) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "users", uid, "calendario", eventoId));
      setEventos(eventos.filter((e) => e.id !== eventoId));
      showSuccess(t("success.deleted"));
    } catch (error) {
      handleError(error, t("errors.delete"));
    }
  };

  const handleCambiarEstado = async (eventoId: string, nuevoEstado: Estado) => {
    if (!uid) return;
    try {
      const eventoRef = doc(db, "users", uid, "calendario", eventoId);
      await updateDoc(eventoRef, { estado: nuevoEstado });
      setEventos((prev) =>
        prev.map((e) => (e.id === eventoId ? { ...e, estado: nuevoEstado } : e))
      );
      showSuccess(t("success.stateUpdated"));
    } catch (error) {
      handleError(error, t("errors.updateStatus"));
    }
  };

  return (
    <>
      {/* Overrides de estilos para integrarse con el tema */}
      <style>{`
        /* Contenedor del calendario de react-day-picker */
        .rdp {
          background: hsl(var(--card));
          color: hsl(var(--card-foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 0.5rem;
        }
        .rdp-caption_label { font-weight: 600; }
        .rdp-head_cell { color: hsl(var(--muted-foreground)); }
        .rdp-day { color: hsl(var(--card-foreground)); }
        .rdp-day_today { outline: 1px dashed hsl(var(--primary)); outline-offset: 2px; }
        .rdp-day_selected:not([disabled]) {
          background-color: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
          border-radius: 0.375rem !important;
        }

        /* Etiquetas de días con eventos (clases personalizadas) */
        .event-day-por-hacer {
          background-color: rgba(239, 68, 68, 0.18) !important;  /* red-500 ~ */
          border-radius: 0.375rem !important;
        }
        .event-day-en-proceso {
          background-color: rgba(245, 158, 11, 0.18) !important; /* amber-500 ~ */
          border-radius: 0.375rem !important;
        }
        .event-day-completado {
          background-color: rgba(34, 197, 94, 0.18) !important;  /* green-500 ~ */
          border-radius: 0.375rem !important;
        }
        /* Un pelín más intensas en dark */
        .dark .event-day-por-hacer { background-color: rgba(239, 68, 68, 0.28) !important; }
        .dark .event-day-en-proceso { background-color: rgba(245, 158, 11, 0.28) !important; }
        .dark .event-day-completado { background-color: rgba(34, 197, 94, 0.25) !important; }
      `}</style>

      <div className="flex flex-col gap-8 p-4">
        <div className="border border-border rounded-lg p-4 shadow-sm bg-card text-card-foreground">
          <h3 className="text-lg font-semibold mb-3">➕ {t("addEventTitle")}</h3>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAgregar();
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Tipo */}
              <div className="flex flex-col">
                <label className="block text-sm font-bold mb-1">{t("form.typeLabel")}</label>
                <select
                  className="border border-border rounded px-2 py-1 text-sm bg-background text-foreground
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as "guion" | "video")}
                >
                  <option value="guion">{t("types.guion")}</option>
                  <option value="video">{t("types.video")}</option>
                </select>
              </div>

              {/* Selección de ítem */}
              <div className="flex flex-col">
                <label className="block text-sm font-bold mb-1">
                  {t("form.itemLabel", {
                    type: t(tipo === "guion" ? "types.guion" : "types.video"),
                  })}
                </label>
                <select
                  className="border border-border rounded px-2 py-1 text-sm bg-background text-foreground
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                >
                  <option value="">
                    {t("form.itemLabel", { type: t(tipo === "guion" ? "types.guion" : "types.video") })}
                  </option>
                  {(tipo === "guion" ? guiones : videos).map((i) => (
                    <option key={i.firebaseId} value={i.firebaseId}>
                      {i.titulo}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div className="flex flex-col">
                <label className="block text-sm font-bold mb-1">{t("form.dateLabel")}</label>
                <input
                  type="date"
                  className="border border-border rounded px-2 py-1 text-sm bg-background text-foreground
                             placeholder:text-muted-foreground
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  value={fechaEvento}
                  onChange={(e) => setFechaEvento(e.target.value)}
                />
              </div>

              {/* Hora */}
              <div className="flex flex-col">
                <label className="block text-sm font-bold mb-1">{t("form.timeLabel")}</label>
                <input
                  type="time"
                  className="border border-border rounded px-2 py-1 text-sm bg-background text-foreground
                             placeholder:text-muted-foreground
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  value={horaEvento}
                  onChange={(e) => setHoraEvento(e.target.value)}
                />
              </div>

              {/* Botón */}
              <div className="flex flex-col justify-end">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm hover:bg-primary/90 h-[34px]"
                >
                  {t("form.addButton")}
                </button>
              </div>
            </div>

            {/* Switch para publicar en redes */}
            {tipo === "video" && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="publicarEnRedes"
                  checked={publicarEnRedes}
                  onChange={(e) => setPublicarEnRedes(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="publicarEnRedes" className="text-sm text-muted-foreground">
                  {t("form.publishSwitch")}
                </label>
              </div>
            )}
          </form>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Calendario */}
          <div className="w-full md:w-1/2 lg:w-1/3">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={setSelected}
              modifiers={{
                porHacer: fechasPorHacer,
                enProceso: fechasEnProceso,
                completado: fechasCompletado,
              }}
              modifiersClassNames={{
                porHacer: "event-day-por-hacer",
                enProceso: "event-day-en-proceso",
                completado: "event-day-completado",
              }}
              locale={dfLocale}
              fixedWeeks
              pagedNavigation
              showOutsideDays
              className="rdp text-left"
              formatters={{
                formatWeekdayName: (weekday: Date) => {
                  return weekdayShort[weekday.getDay()];
                },
              }}
            />
          </div>

          {/* Lista de eventos */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-4">
              {selected
                ? t("list.titleForDay", {
                    date: selected.toLocaleDateString(localeCode === "en" ? "en-US" : "es-ES"),
                  })
                : t("list.selectADay")}
            </h3>

            {selected && eventosDelDia.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("list.noneForDay")}</p>
            )}

            <ul className="space-y-3">
              {eventosDelDia.map((e) => {
                let estadoColor = "";
                switch (e.estado) {
                  case "por_hacer":
                    estadoColor = "bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-800";
                    break;
                  case "en_proceso":
                    estadoColor = "bg-orange-100 border-orange-300 dark:bg-orange-900/30 dark:border-orange-800";
                    break;
                  case "completado":
                    estadoColor = "bg-green-100 border-green-300 dark:bg-green-900/25 dark:border-green-800";
                    break;
                }

                return (
                  <li
                    key={e.id}
                    className={`border rounded-lg p-3 shadow-sm transition relative bg-card/50 ${estadoColor}`}
                  >
                    <p className="text-sm text-muted-foreground">
                      {e.tipo === "guion" ? `📜 ${t("types.guion")}` : `🎬 ${t("types.video")}`}
                      {e.syncedWithMetricool && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 px-2 py-0.5 rounded">
                          {t("list.scheduledBadge")}
                        </span>
                      )}
                    </p>
                    <p className="font-semibold text-card-foreground">{e.titulo}</p>
                    <p className="text-sm text-muted-foreground">🗓 {e.fecha}</p>
                    {e.plataforma && (
                      <p className="text-xs text-muted-foreground">
                        {t("list.platformStatus", {
                          platform: e.plataforma,
                          status: e.status ?? ""
                        })}
                      </p>
                    )}
                    <div className="flex gap-2 mt-3">
                      <select
                        value={e.estado}
                        onChange={(ev) =>
                          handleCambiarEstado(e.id, ev.target.value as Estado)
                        }
                        className="text-xs border border-border rounded p-1 bg-background text-foreground
                                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <option value="por_hacer">{t("states.por_hacer")}</option>
                        <option value="en_proceso">{t("states.en_proceso")}</option>
                        <option value="completado">{t("states.completado")}</option>
                      </select>

                      <button
                        onClick={() => handleEliminarEvento(e.id)}
                        className="text-xs bg-destructive text-destructive-foreground rounded px-2 py-1 hover:bg-destructive/90"
                      >
                        {t("actions.delete")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
