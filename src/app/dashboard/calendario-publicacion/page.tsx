"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

// Simulación de vídeos planificados
const videosPlanificados = [
  {
    id: "1",
    titulo: "Reel: Cómo optimizar tu Instagram",
    fecha: "2025-08-10",
  },
  {
    id: "2",
    titulo: "Reel: 5 trucos de redes sociales",
    fecha: "2025-08-15",
  },
];

function formatDateToISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarioPublicacion() {
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  // Días con vídeos planificados
  const diasConVideos = videosPlanificados.map((v) => {
    const [y, m, d] = v.fecha.split("-").map(Number);
    return new Date(y, m - 1, d);
  });

  // Filtrar vídeos por el día seleccionado
  const videosDelDia =
    selected &&
    videosPlanificados.filter((v) => v.fecha === formatDateToISO(selected));

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="text-blue-600" size={28} />
          <h1 className="text-2xl font-bold">Calendario de Publicación</h1>
        </div>
        <p className="mb-6 text-gray-600 text-center">
          Visualiza las fechas planificadas para tus vídeos (Reels).
          <br />
          Pronto será integrable con Metricool.
        </p>

        {/* Calendario visual */}
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={setSelected}
          locale={es}
          showOutsideDays
          modifiers={{
            tieneVideo: diasConVideos,
          }}
          modifiersClassNames={{
            tieneVideo: "bg-blue-200 text-blue-900 font-bold",
          }}
          className="mb-8"
        />

        {/* Mostrar vídeos del día seleccionado */}
        {selected ? (
          <div className="w-full">
            <h3 className="font-semibold mb-2 text-blue-700 flex items-center gap-2">
              {selected.toLocaleDateString("es-ES")}
            </h3>
            {videosDelDia && videosDelDia.length > 0 ? (
              <ul className="space-y-2">
                {videosDelDia.map((v) => (
                  <li
                    key={v.id}
                    className="border-l-4 border-blue-400 pl-3 py-2 bg-blue-50 rounded shadow text-gray-800"
                  >
                    {v.titulo}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">
                No hay vídeos planificados para este día.
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-500">
            Selecciona un día para ver los vídeos planificados.
          </p>
        )}
      </div>
    </div>
  );
}
