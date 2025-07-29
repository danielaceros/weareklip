"use client";

import { useState, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { es } from 'date-fns/locale';
import { db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp
} from "firebase/firestore";
import { handleError, showSuccess } from "@/lib/errors";

type Item = {
  firebaseId: string;
  titulo: string;
};

type Estado = "por_hacer" | "en_proceso" | "completado";

type Evento = {
  id: string;
  tipo: "guion" | "video";
  titulo: string;
  fecha: string;
  estado: Estado;
  refId: string;
};

type Props = {
  uid: string;
  guiones: Item[];
  videos: Item[];
};

function formatDateToISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CalendarioMensual({ uid, guiones, videos }: Props) {
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [tipo, setTipo] = useState<"guion" | "video">("guion");
  const [itemId, setItemId] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");

  const fetchEventos = async () => {
    if (!uid) return;
    try {
      const snap = await getDocs(collection(db, "users", uid, "calendario"));
      const data = snap.docs.map((doc) => {
        const d = doc.data();
        const fechaDate = d.fecha.toDate();
        return {
          id: doc.id,
          tipo: d.tipo,
          titulo: d.titulo,
          fecha: formatDateToISO(fechaDate),
          estado: d.estado || "por_hacer",
          refId: d.refId
        };
      });
      setEventos(data);
    } catch (error) {
      handleError(error, "Error cargando eventos del calendario");
    }
  };

  useEffect(() => {
    fetchEventos();
  }, [uid]);

  useEffect(() => {
    const eventosAEliminar = eventos.filter(evento => {
      const items = evento.tipo === "guion" ? guiones : videos;
      return !items.some(item => item.firebaseId === evento.refId);
    });

    if (eventosAEliminar.length > 0) {
      const eliminarEventos = async () => {
        for (const evento of eventosAEliminar) {
          try {
            await deleteDoc(doc(db, "users", uid, "calendario", evento.id));
          } catch (error) {
            handleError(error, "Error eliminando evento huérfano");
          }
        }
        setEventos(prev => prev.filter(e => 
          !eventosAEliminar.some(ae => ae.id === e.id)
        ));
      };
      eliminarEventos();
    }
  }, [guiones, videos, eventos, uid]);

  type DiaInfo = {
    estado: Estado | null;
    cantidad: number;
  };

  const eventosPorDia: Record<string, DiaInfo> = {};

  eventos.forEach(evento => {
    const fecha = evento.fecha;
    if (!eventosPorDia[fecha]) {
      eventosPorDia[fecha] = {
        estado: evento.estado,
        cantidad: 1
      };
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
    const [year, month, day] = fechaISO.split('-').map(Number);
    const fecha = new Date(year, month - 1, day);
    
    if (info.estado === "por_hacer") {
      fechasPorHacer.push(fecha);
    } else if (info.estado === "en_proceso") {
      fechasEnProceso.push(fecha);
    } else if (info.estado === "completado") {
      fechasCompletado.push(fecha);
    }
  });

  const eventosDelDia = selected
    ? eventos.filter((e) => e.fecha === formatDateToISO(selected))
    : [];

  const handleAgregar = async () => {
    if (!itemId || !fechaEvento) {
      handleError(null, "Selecciona un ítem y una fecha");
      return;
    }

    const fuente = tipo === "guion" ? guiones : videos;
    const item = fuente.find((i) => i.firebaseId === itemId);

    if (!item) {
      handleError(null, "Ítem no encontrado");
      return;
    }

    try {
      await addDoc(collection(db, "users", uid, "calendario"), {
        tipo,
        refId: itemId,
        titulo: item.titulo,
        fecha: Timestamp.fromDate(new Date(fechaEvento)),
        estado: "por_hacer"
      });
      setItemId("");
      setFechaEvento("");
      fetchEventos();
      showSuccess("Evento agregado correctamente");
    } catch (error) {
      handleError(error, "No se pudo crear el evento");
    }
  };

  const handleEliminarEvento = async (eventoId: string) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "users", uid, "calendario", eventoId));
      setEventos(eventos.filter(e => e.id !== eventoId));
      showSuccess("Evento eliminado");
    } catch (error) {
      handleError(error, "Error al eliminar el evento");
    }
  };

  const handleCambiarEstado = async (eventoId: string, nuevoEstado: Estado) => {
    if (!uid) return;
    try {
      const eventoRef = doc(db, "users", uid, "calendario", eventoId);
      await updateDoc(eventoRef, { estado: nuevoEstado });
      setEventos(eventos.map(e => 
        e.id === eventoId ? { ...e, estado: nuevoEstado } : e
      ));
      showSuccess("Estado actualizado");
    } catch (error) {
      handleError(error, "Error al actualizar el estado");
    }
  };

  return (
    <>
      <style>{`
        .event-day-por-hacer {
          background-color: #fee2e2 !important;
          border-radius: 0.375rem !important;
        }
        
        .event-day-en-proceso {
          background-color: #ffedd5 !important;
          border-radius: 0.375rem !important;
        }
        
        .event-day-completado {
          background-color: #dcfce7 !important;
          border-radius: 0.375rem !important;
        }

        .rdp-day_selected:not([disabled]) {
          background-color: #3b82f6 !important;
          color: white !important;
          border-radius: 0.375rem !important;
        }
        
        .event-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background-color: #3b82f6;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
        }
      `}</style>

      <div className="flex flex-col gap-8 p-4">
        <div className="border rounded p-4 shadow">
          <h3 className="text-lg font-semibold mb-3">➕ Añadir evento</h3>
          
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAgregar();
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="flex flex-col">
                <label className="block text-sm font-bold mb-1">Cómo</label>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as "guion" | "video")}
                >
                  <option value="guion">Guion</option>
                  <option value="video">Video</option>
                </select>
              </div>
              
              <div className="flex flex-col">
                <label className="block text-sm font-bold mb-1">
                  Seleccionar {tipo}
                </label>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                >
                  <option value="">Seleccionar {tipo}</option>
                  {(tipo === "guion" ? guiones : videos).map((i) => (
                    <option key={i.firebaseId} value={i.firebaseId}>
                      {i.titulo}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col">
                <label className="block text-sm font-bold mb-1">Fecha</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1 text-sm"
                  value={fechaEvento}
                  onChange={(e) => setFechaEvento(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 text-white rounded px-3 py-1.5 text-sm hover:bg-blue-700 h-[34px]"
                >
                  Agregar
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/2 lg:w-1/3">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={setSelected}
              modifiers={{
                porHacer: fechasPorHacer,
                enProceso: fechasEnProceso,
                completado: fechasCompletado
              }}
              modifiersClassNames={{
                porHacer: "event-day-por-hacer",
                enProceso: "event-day-en-proceso",
                completado: "event-day-completado"
              }}
              locale={es}
              fixedWeeks
              pagedNavigation
              showOutsideDays
              className="text-left"
              formatters={{
                formatWeekdayName: (weekday) => {
                  const weekdays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
                  return weekdays[weekday.getDay()];
                }
              }}
            />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-4">
              {selected
                ? `Eventos en ${selected.toLocaleDateString('es-ES')}`
                : "Selecciona un día para ver eventos"}
            </h3>

            {selected && eventosDelDia.length === 0 && (
              <p className="text-sm text-gray-500">No hay eventos para este día.</p>
            )}

            <ul className="space-y-3">
              {eventosDelDia.map((e) => {
                let estadoColor = "";
                switch (e.estado) {
                  case "por_hacer":
                    estadoColor = "bg-red-100 border-red-300";
                    break;
                  case "en_proceso":
                    estadoColor = "bg-orange-100 border-orange-300";
                    break;
                  case "completado":
                    estadoColor = "bg-green-100 border-green-300";
                    break;
                }
                
                return (
                  <li
                    key={e.id}
                    className={`border rounded p-3 shadow-sm transition relative ${estadoColor}`}
                  >
                    <p className="text-sm text-muted-foreground">
                      {e.tipo === "guion" ? "📜 Guion" : "🎬 Video"}
                    </p>
                    <p className="font-semibold">{e.titulo}</p>
                    <p className="text-sm text-gray-600">🗓 {e.fecha}</p>
                    
                    <div className="flex gap-2 mt-3">
                      <select
                        value={e.estado}
                        onChange={(ev) => 
                          handleCambiarEstado(e.id, ev.target.value as Estado)
                        }
                        className="text-xs border rounded p-1 bg-white"
                      >
                        <option value="por_hacer">🟥 Por hacer</option>
                        <option value="en_proceso">🟧 En proceso</option>
                        <option value="completado">🟩 Completado</option>
                      </select>
                      
                      <button
                        onClick={() => handleEliminarEvento(e.id)}
                        className="text-xs bg-red-500 text-white rounded px-2 py-1 hover:bg-red-600"
                      >
                        Eliminar
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