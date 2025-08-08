"use client";

import { useState } from "react";
import {
  Lightbulb,
  Heart,
  Sparkles,
  Youtube,
  Instagram,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Simulamos ideas virales (futuro: IA/Redes)
const DUMMY_IDEAS = [
  {
    id: 1,
    title: "Trend: ¿Qué prefieres? 🔥",
    description:
      "Reta a tus seguidores a responder preguntas rápidas de “¿Qué prefieres?”. Es ideal para reels y TikTok.",
    source: "TikTok",
    category: "Challenge",
  },
  {
    id: 2,
    title: "Storytime impactante",
    description:
      "Cuenta una anécdota corta que sorprenda. Usa cortes rápidos y texto en pantalla para mantener la atención.",
    source: "Instagram",
    category: "Storytelling",
  },
  {
    id: 3,
    title: "Antes vs Después",
    description:
      "Muestra el proceso de cambio (cambio físico, setup, transformación). El formato ‘antes y después’ nunca falla.",
    source: "YouTube",
    category: "Transformación",
  },
  {
    id: 4,
    title: "Consejo rápido en 30 segundos",
    description:
      "Ofrece un tip concreto relacionado con tu nicho, en formato super breve y visual.",
    source: "IA",
    category: "Tip",
  },
  {
    id: 5,
    title: "Imita a un famoso viral",
    description:
      "Haz una imitación de un audio/meme viral reciente. Usa efectos de voz o filtro.",
    source: "TikTok",
    category: "Humor",
  },
];

type Idea = (typeof DUMMY_IDEAS)[number];

// Icono de red
const SourceIcon = ({ source }: { source: string }) => {
  switch (source) {
    case "Instagram":
      return <Instagram className="text-pink-600" size={18} />;
    case "YouTube":
      return <Youtube className="text-red-500" size={18} />;
    case "IA":
      return <Sparkles className="text-blue-500" size={18} />;
    default:
      return <Sparkles size={18} />;
  }
};

// Card visual y animada
function ViralIdeaCard({
  idea,
  isFavorite,
  onFavorite,
  onGenerate,
}: {
  idea: Idea;
  isFavorite: boolean;
  onFavorite: () => void;
  onGenerate: () => void;
}) {
  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-3 relative group border hover:border-blue-400 transition"
      whileHover={{ y: -8, boxShadow: "0 6px 28px #93c5fd44" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.25 }}
    >
      {/* Marca como favorita */}
      <button
        onClick={onFavorite}
        className="absolute top-3 right-3"
        title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
      >
        <motion.span
          initial={false}
          animate={{
            scale: isFavorite ? 1.15 : 1,
            color: isFavorite ? "#e11d48" : "#cbd5e1",
          }}
        >
          <Heart fill={isFavorite ? "#e11d48" : "none"} size={22} />
        </motion.span>
      </button>
      <div className="flex items-center gap-2 mb-1">
        <SourceIcon source={idea.source} />
        <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 font-semibold">
          {idea.source}
        </span>
        <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
          {idea.category}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Lightbulb className="text-yellow-400" size={18} />
        <h3 className="font-bold text-lg">{idea.title}</h3>
      </div>
      <div className="text-gray-600 text-sm">{idea.description}</div>
      <button
        className="mt-2 w-full bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white rounded-xl py-2 font-semibold flex items-center justify-center gap-2 shadow transition"
        onClick={onGenerate}
      >
        <Sparkles size={18} /> Usar esta idea
      </button>
    </motion.div>
  );
}

// Modal de confirmación animado
function GeneratedModal({
  show,
  onClose,
  ideaTitle,
}: {
  show: boolean;
  onClose: () => void;
  ideaTitle: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl p-8 max-w-xs shadow-lg flex flex-col items-center"
            initial={{ scale: 0.9, y: 60 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <CheckCircle className="text-green-500 mb-2" size={36} />
            <h4 className="font-bold text-lg mb-2 text-center">
              ¡Guión generado!
            </h4>
            <div className="text-gray-600 mb-4 text-sm text-center">
              Basado en la idea:
              <br />
              <span className="font-semibold text-blue-500">{ideaTitle}</span>
            </div>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-4 py-2 mt-2 transition"
              onClick={onClose}
            >
              Cerrar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function IdeasViralesPage() {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalIdeaTitle, setModalIdeaTitle] = useState("");

  const handleFavorite = (id: number) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const handleGenerate = (ideaTitle: string) => {
    setModalIdeaTitle(ideaTitle);
    setShowModal(true);
    // Aquí luego harías la llamada para generar guion
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center bg-gradient-to-br from-yellow-50 to-blue-50 py-10 px-2">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-lg p-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="text-violet-500" size={28} />
          <h1 className="text-3xl font-bold">Ideas Virales para tus vídeos</h1>
        </div>
        <p className="mb-8 text-gray-600 max-w-2xl">
          Descubre ideas virales generadas con IA o inspiradas en tendencias de
          TikTok, Instagram y YouTube.
          <br />
          Marca tus favoritas y crea un guión en 1 click.
        </p>

        {/* Grid scrollable de ideas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-h-[500px] overflow-y-auto pb-4">
          <AnimatePresence>
            {DUMMY_IDEAS.map((idea) => (
              <ViralIdeaCard
                key={idea.id}
                idea={idea}
                isFavorite={favorites.includes(idea.id)}
                onFavorite={() => handleFavorite(idea.id)}
                onGenerate={() => handleGenerate(idea.title)}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Modal animado de "guión generado" */}
        <GeneratedModal
          show={showModal}
          onClose={() => setShowModal(false)}
          ideaTitle={modalIdeaTitle}
        />
      </div>

      {/* Tus favoritas */}
      <div className="w-full max-w-6xl mx-auto bg-yellow-50 rounded-2xl shadow-md p-6 mt-10">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Heart className="text-red-500" size={20} /> Tus Ideas Favoritas
        </h2>
        {favorites.length === 0 ? (
          <p className="text-gray-400">
            Marca ideas como favoritas para tenerlas aquí.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-4 mt-2">
            {DUMMY_IDEAS.filter((i) => favorites.includes(i.id)).map((idea) => (
              <li
                key={idea.id}
                className="bg-white rounded-xl border border-yellow-200 px-4 py-2 shadow flex items-center gap-2"
              >
                <SourceIcon source={idea.source} />
                <span className="font-medium">{idea.title}</span>
                <button
                  onClick={() => handleFavorite(idea.id)}
                  className="ml-1 text-xs text-red-400 hover:text-red-600 transition"
                  title="Quitar de favoritos"
                >
                  <Heart fill="#f87171" size={17} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
