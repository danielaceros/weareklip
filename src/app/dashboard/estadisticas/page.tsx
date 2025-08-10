"use client";

import { useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users2,
  CalendarCheck2,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";

// Simulación de datos de métricas
const stats = {
  alcanceEstimado: 9000,
  alcanceReal: 7300,
  engagement: 4.3,
  frecuencia: 3,
  seguidores: 1280,
};

const historialPublicaciones = [
  { semana: "24 Jun", posts: 4 },
  { semana: "01 Jul", posts: 2 },
  { semana: "08 Jul", posts: 3 },
  { semana: "15 Jul", posts: 5 },
  { semana: "22 Jul", posts: 3 },
  { semana: "29 Jul", posts: 4 },
];

// Tooltips info para cada KPI
const KPI_INFO = [
  "El alcance mide cuántas personas han visto tus vídeos.",
  "El engagement refleja la interacción real de tus seguidores.",
  "La frecuencia recomendada para crecer es de 3 a 5 publicaciones por semana.",
  "Seguidores simulados en tu cuenta de prueba.",
];

// ---------- INTERFAZ TIPADA PARA LA CARD ----------
interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  info: string;
  color: string;
  meta?: string;
}

// Card de KPI con animación y tooltip
function StatCard({ icon, value, label, info, color, meta }: StatCardProps) {
  const [show, setShow] = useState(false);
  return (
    <motion.div
      className={`relative bg-white border-2 rounded-2xl p-6 flex flex-col items-center shadow hover:shadow-lg transition cursor-pointer group`}
      whileHover={{ scale: 1.05, boxShadow: "0px 6px 30px 0px #aaa2" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{
        borderColor: color,
        minWidth: 180,
        minHeight: 150,
      }}
    >
      <div className={`mb-2`}>{icon}</div>
      <motion.div
        className={`text-2xl font-bold`}
        style={{ color }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {value}
      </motion.div>
      <div className="text-xs text-gray-500">{label}</div>
      {meta && <div className="text-sm mt-1 text-gray-400">{meta}</div>}
      <Info
        size={17}
        className="absolute top-3 right-3 text-gray-400 opacity-60"
      />
      {show && (
        <motion.div
          className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg w-[200px]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {info}
        </motion.div>
      )}
    </motion.div>
  );
}

// Gráfica de barras animada e interactiva
function FrecuenciaBarChart({
  data,
}: {
  data: { semana: string; posts: number }[];
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.posts), 5);
  return (
    <div className="w-full flex items-end gap-4 h-48 mt-2 px-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center flex-1 relative">
          <motion.div
            className={`rounded-xl cursor-pointer ${
              hovered === i ? "bg-blue-600" : "bg-blue-400"
            } shadow-md`}
            style={{
              width: "38px",
              height: `${(d.posts / max) * 140 + 16}px`,
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          ></motion.div>
          {hovered === i && (
            <motion.div
              className="absolute bottom-full mb-2 px-3 py-1 rounded-xl bg-blue-700 text-white text-xs font-semibold shadow-lg z-10"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {d.posts} publicaciones
            </motion.div>
          )}
          <div className="text-xs text-gray-500 mt-2">{d.semana}</div>
        </div>
      ))}
    </div>
  );
}

export default function EstadisticasPage() {
  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 py-10 px-2">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-lg p-10">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="text-blue-600" size={28} />
          <h1 className="text-3xl font-bold">Estadísticas de tu contenido</h1>
        </div>
        <p className="mb-10 text-gray-600 max-w-xl">
          Revisa el rendimiento simulado de tus publicaciones.
          <br />
          Cuando actives Metricool verás aquí tus estadísticas reales.
        </p>

        {/* KPIs principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            icon={<TrendingUp className="text-blue-500" size={28} />}
            value={stats.alcanceReal.toLocaleString()}
            label="Alcance real"
            info={KPI_INFO[0]}
            color="#2563eb"
            meta={`Estimado: ${stats.alcanceEstimado.toLocaleString()}`}
          />
          <StatCard
            icon={<Users2 className="text-pink-500" size={28} />}
            value={stats.engagement + "%"}
            label="Engagement"
            info={KPI_INFO[1]}
            color="#db2777"
            meta="Meta: 5%"
          />
          <StatCard
            icon={<CalendarCheck2 className="text-green-500" size={28} />}
            value={stats.frecuencia + " /sem"}
            label="Frecuencia publicación"
            info={KPI_INFO[2]}
            color="#059669"
            meta="Recomendado: 3/sem"
          />
          <StatCard
            icon={<Users2 className="text-yellow-500" size={28} />}
            value={stats.seguidores}
            label="Seguidores simulados"
            info={KPI_INFO[3]}
            color="#eab308"
          />
        </div>

        {/* Gráfica de barras animada */}
        <div className="bg-gradient-to-r from-blue-50 via-white to-purple-50 rounded-2xl shadow p-8 mt-4">
          <h3 className="text-lg font-bold text-blue-700 flex items-center gap-2 mb-2">
            <CalendarCheck2 className="text-blue-500" size={18} />
            Historial de publicaciones por semana
          </h3>
          <FrecuenciaBarChart data={historialPublicaciones} />
          <div className="text-xs text-gray-500 mt-4 text-center">
            * Datos de muestra. Integra Metricool para ver tus estadísticas
            reales.
          </div>
        </div>
      </div>
    </div>
  );
}
