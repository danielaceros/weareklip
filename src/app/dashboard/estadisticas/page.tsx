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
import { useT } from "@/lib/i18n";

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

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  info: string;
  color: string; // usamos este solo para el borde y valor
  meta?: string;
}

function StatCard({ icon, value, label, info, color, meta }: StatCardProps) {
  const [show, setShow] = useState(false);
  return (
    <motion.div
      className="relative bg-card border-2 border-border rounded-2xl p-6 flex flex-col items-center shadow-sm hover:shadow transition cursor-pointer group"
      whileHover={{ scale: 1.03 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ borderColor: color, minWidth: 180, minHeight: 150 }}
    >
      <div className="mb-2">{icon}</div>
      <motion.div
        className="text-2xl font-bold"
        style={{ color }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {value}
      </motion.div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {meta && <div className="text-sm mt-1 text-muted-foreground/80">{meta}</div>}
      <Info size={17} className="absolute top-3 right-3 text-muted-foreground/60" />
      {show && (
        <motion.div
          className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-2 rounded px-3 py-2 shadow-lg w-[200px] bg-popover text-popover-foreground"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {info}
        </motion.div>
      )}
    </motion.div>
  );
}

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
            className={`rounded-xl cursor-pointer shadow ${
              hovered === i ? "bg-primary" : "bg-primary/70"
            }`}
            style={{
              width: "38px",
              height: `${(d.posts / max) * 140 + 16}px`,
              transformOrigin: "bottom",
            }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
          {hovered === i && (
            <motion.div
              className="absolute bottom-full mb-2 px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-lg z-10"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {d.posts} publicaciones
            </motion.div>
          )}
          <div className="text-xs text-muted-foreground mt-2">{d.semana}</div>
        </div>
      ))}
    </div>
  );
}

export default function EstadisticasPage() {
  const t = useT();

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center bg-background py-10 px-2">
      <div className="w-full max-w-5xl bg-card border border-border rounded-3xl shadow-sm p-10 text-foreground">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="text-primary" size={28} />
          <h1 className="text-3xl font-bold">{t("statsPage.title")}</h1>
        </div>
        <p className="mb-10 text-muted-foreground max-w-xl whitespace-pre-line">
          {t("statsPage.description")}
        </p>

        {/* KPIs principales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            icon={<TrendingUp className="text-primary" size={28} />}
            value={stats.alcanceReal.toLocaleString()}
            label={t("statsPage.kpi.reach.label")}
            info={t("statsPage.kpi.reach.info")}
            color="#2563eb"
            meta={t("statsPage.kpi.reach.meta", {
              value: stats.alcanceEstimado.toLocaleString(),
            })}
          />
          <StatCard
            icon={<Users2 className="text-pink-500" size={28} />}
            value={`${stats.engagement}%`}
            label={t("statsPage.kpi.engagement.label")}
            info={t("statsPage.kpi.engagement.info")}
            color="#db2777"
            meta={t("statsPage.kpi.engagement.meta")}
          />
          <StatCard
            icon={<CalendarCheck2 className="text-green-500" size={28} />}
            value={`${stats.frecuencia} /sem`}
            label={t("statsPage.kpi.frequency.label")}
            info={t("statsPage.kpi.frequency.info")}
            color="#059669"
            meta={t("statsPage.kpi.frequency.meta")}
          />
          <StatCard
            icon={<Users2 className="text-yellow-500" size={28} />}
            value={stats.seguidores}
            label={t("statsPage.kpi.followers.label")}
            info={t("statsPage.kpi.followers.info")}
            color="#eab308"
          />
        </div>

        {/* Gráfica de barras */}
        <div className="rounded-2xl border border-border bg-muted p-8 mt-4">
          <h3 className="text-lg font-bold text-primary flex items-center gap-2 mb-2">
            <CalendarCheck2 className="text-primary" size={18} />
            {t("statsPage.history.title")}
          </h3>
          <FrecuenciaBarChart data={historialPublicaciones} />
          <div className="text-xs text-muted-foreground mt-4 text-center">
            {t("statsPage.history.note")}
          </div>
        </div>
      </div>
    </div>
  );
}
