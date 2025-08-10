"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { es, enUS } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useT, getStoredLocale } from "@/lib/i18n";

/** —— Datos de ejemplo —— */
const videosPlanificados = [
  { id: "1", titulo: "Reel: Cómo optimizar tu Instagram", fecha: "2025-08-10" },
  { id: "2", titulo: "Reel: 5 trucos de redes sociales", fecha: "2025-08-15" },
];

function formatDateToISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarioPublicacion() {
  const t = useT();
  const localeCode = getStoredLocale();
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  const diasConVideos = videosPlanificados.map((v) => {
    const [y, m, d] = v.fecha.split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  const videosDelDia =
    selected &&
    videosPlanificados.filter((v) => v.fecha === formatDateToISO(selected));

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl mx-auto rounded-3xl bg-card border border-border shadow-md p-8 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="text-primary" size={28} />
          <h1 className="text-2xl font-bold text-foreground">
            {t("calendarPage.title")}
          </h1>
        </div>

        <p className="mb-6 text-sm text-muted-foreground text-center">
          {t("calendarPage.description")}
        </p>

        <DayPicker
          mode="single"
          selected={selected}
          onSelect={setSelected}
          locale={localeCode === "es" ? es : enUS}
          showOutsideDays
          /* Marca los días con contenido */
          modifiers={{ tieneVideo: diasConVideos }}
          /* Estilos compatibles con light/dark */
          className="mb-8 text-foreground"
          classNames={{
            caption: "flex items-center justify-between px-2 py-3 font-medium",
            caption_label: "text-sm sm:text-base",
            nav: "flex items-center gap-2",
            button_previous:
              "h-7 w-7 rounded-md bg-muted hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/40",
            button_next:
              "h-7 w-7 rounded-md bg-muted hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/40",

            months: "flex flex-col gap-4",
            month: "space-y-2",
            weekdays: "grid grid-cols-7 text-xs text-muted-foreground",
            weekday: "text-center py-1",
            weeks: "space-y-1",
            week: "grid grid-cols-7 gap-1",
            day: [
              "relative h-9 w-9 rounded-md text-sm",
              "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/40",
              "aria-disabled:opacity-40 aria-disabled:cursor-not-allowed",
            ].join(" "),
            day_button: "h-full w-full rounded-md",
            day_outside: "text-muted-foreground/50",
            day_today: "ring-1 ring-primary/40",
            day_selected:
              "bg-primary text-primary-foreground hover:bg-primary/90",
            day_disabled: "opacity-40",
          }}
          /* Badge suave para días con vídeos */
          modifiersClassNames={{
            tieneVideo:
              "bg-primary/15 dark:bg-primary/20 text-primary ring-1 ring-primary/30 hover:bg-primary/20",
          }}
        />

        {selected ? (
          <div className="w-full">
            <h3 className="font-semibold mb-2 text-primary flex items-center gap-2">
              {selected.toLocaleDateString(
                localeCode === "es" ? "es-ES" : "en-US"
              )}
            </h3>

            {videosDelDia && videosDelDia.length > 0 ? (
              <ul className="space-y-2">
                {videosDelDia.map((v) => (
                  <li
                    key={v.id}
                    className="border-l-4 border-primary/60 pl-3 py-2 rounded bg-muted text-foreground shadow-sm"
                  >
                    {v.titulo}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                {t("calendarPage.noVideos")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {t("calendarPage.selectDay")}
          </p>
        )}
      </div>
    </div>
  );
}
