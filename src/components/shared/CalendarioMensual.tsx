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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/* ------------------------------- Tipos ------------------------------- */
type Item = { firebaseId: string; titulo: string; url?: string };
type Estado = "por_hacer" | "en_proceso" | "completado";

type Evento = {
  id: string;
  tipo: "guion" | "video";
  titulo: string;
  fecha: string;
  estado: Estado;
  refId: string;
  syncedWithMetricool?: boolean;
  metricoolId?: string;
  plataforma?: string;
  status?: string;
};

type CalendarDoc = {
  tipo: "guion" | "video";
  titulo: string;
  fecha: unknown;
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
};

/* -------- helpers de fechas -------- */
function toDateSafe(input: unknown): Date {
  if (input == null) return new Date(0);
  if (input instanceof Date) return input;
  if (typeof input === "number") return new Date(input);
  if (typeof input === "string") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }
  if ((input as any)?.toDate) return (input as any).toDate();
  if ((input as any)?.seconds) return new Date((input as any).seconds * 1000);
  return new Date(0);
}
function formatDateToISO(date: Date) {
  return date.toISOString().split("T")[0];
}

/* ------------------------------ Componente ------------------------------ */
export default function CalendarioMensual({ uid, guiones, videos }: Props) {
  const t = useTranslations("calendarWidget");
  const localeCode = useLocale();
  const dfLocale = localeCode === "en" ? enLocale : esLocale;
  const weekdayShort = localeCode === "en"
    ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
    : ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

  const [selected, setSelected] = useState<Date>();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [tipo, setTipo] = useState<"guion" | "video">("guion");
  const [itemId, setItemId] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [horaEvento, setHoraEvento] = useState("");
  const [publicarEnRedes, setPublicarEnRedes] = useState(false);

  const fetchEventos = useCallback(async () => {
    if (!uid) return;
    try {
      const snap = await getDocs(collection(db, "users", uid, "calendario"));
      const data: Evento[] = snap.docs.map((d) => {
        const raw = d.data() as CalendarDoc;
        return {
          id: d.id,
          tipo: raw.tipo,
          titulo: raw.titulo,
          fecha: formatDateToISO(toDateSafe(raw.fecha)),
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

  /* Agrupar eventos */
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
    if (!item) return;

    try {
      await addDoc(collection(db, "users", uid, "calendario"), {
        tipo,
        refId: itemId,
        titulo: item.titulo,
        fecha: Timestamp.fromDate(new Date(fechaEvento)),
        estado: "por_hacer" as Estado,
      });
      showSuccess(t("success.added"));
      setItemId(""); setFechaEvento(""); setHoraEvento(""); setPublicarEnRedes(false);
      fetchEventos();
    } catch (error) {
      handleError(error, t("errors.create"));
    }
  };

  const handleEliminarEvento = async (eventoId: string) => {
    try {
      await deleteDoc(doc(db, "users", uid, "calendario", eventoId));
      setEventos((prev) => prev.filter((e) => e.id !== eventoId));
      showSuccess(t("success.deleted"));
    } catch (error) {
      handleError(error, t("errors.delete"));
    }
  };

  const handleCambiarEstado = async (eventoId: string, nuevoEstado: Estado) => {
    try {
      await updateDoc(doc(db, "users", uid, "calendario", eventoId), { estado: nuevoEstado });
      setEventos((prev) => prev.map((e) => e.id === eventoId ? { ...e, estado: nuevoEstado } : e));
      showSuccess(t("success.stateUpdated"));
    } catch (error) {
      handleError(error, t("errors.updateStatus"));
    }
  };

  return (
    <div className="flex flex-col gap-8 p-4">
      {/* Formulario añadir evento */}
      <div className="border border-border rounded-lg p-4 shadow-sm bg-card">
        <h3 className="text-lg font-semibold mb-3">➕ {t("addEventTitle")}</h3>
        <form onSubmit={(e) => { e.preventDefault(); handleAgregar(); }} className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}
            className="rounded border bg-background px-2 py-1 text-sm">
            <option value="guion">{t("types.guion")}</option>
            <option value="video">{t("types.video")}</option>
          </select>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-sm">
            <option value="">{t("form.itemLabel", { type: t(tipo) })}</option>
            {(tipo === "guion" ? guiones : videos).map((i) => (
              <option key={i.firebaseId} value={i.firebaseId}>{i.titulo}</option>
            ))}
          </select>
          <input type="date" value={fechaEvento} onChange={(e) => setFechaEvento(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-sm"/>
          <input type="time" value={horaEvento} onChange={(e) => setHoraEvento(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-sm"/>
          <Button type="submit" size="sm">{t("form.addButton")}</Button>
        </form>
        {tipo === "video" && (
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input type="checkbox" checked={publicarEnRedes} onChange={(e) => setPublicarEnRedes(e.target.checked)} />
            {t("form.publishSwitch")}
          </label>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Calendario */}
        <div className="w-full md:w-1/2 lg:w-1/3">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={setSelected}
            locale={dfLocale}
            showOutsideDays
            className="rdp bg-card border border-border rounded-md p-2"
            formatters={{
              formatWeekdayName: (day) => weekdayShort[day.getDay()],
            }}
          />
        </div>

        {/* Lista de eventos */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-4">
            {selected ? t("list.titleForDay", { date: selected.toLocaleDateString(localeCode) }) : t("list.selectADay")}
          </h3>
          {selected && eventosDelDia.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("list.noneForDay")}</p>
          )}
          <ul className="space-y-3">
            {eventosDelDia.map((e) => (
              <li key={e.id} className="border rounded-lg p-3 shadow-sm bg-card">
                <div className="flex justify-between items-center">
                  <p className="font-medium">{e.titulo}</p>
                  <Badge variant={
                    e.estado === "por_hacer" ? "destructive" :
                    e.estado === "en_proceso" ? "secondary" : "default"
                  }>
                    {t(`states.${e.estado}`)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{e.tipo === "guion" ? "📜" : "🎬"} {e.fecha}</p>
                <div className="flex gap-2 mt-2">
                  <select value={e.estado} onChange={(ev) => handleCambiarEstado(e.id, ev.target.value as Estado)}
                    className="rounded border bg-background px-2 py-1 text-xs">
                    <option value="por_hacer">{t("states.por_hacer")}</option>
                    <option value="en_proceso">{t("states.en_proceso")}</option>
                    <option value="completado">{t("states.completado")}</option>
                  </select>
                  <Button size="sm" variant="destructive" onClick={() => handleEliminarEvento(e.id)}>
                    {t("actions.delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
