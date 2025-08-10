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
import { useT } from "@/lib/i18n";

type Idea = {
  id: number;
  title: string;
  description: string;
  source: string;
  category: string;
};

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

const useIdeas = (t: (key: string) => string): Idea[] => [
  {
    id: 1,
    title: t("viralIdeasPage.ideas.trend.title"),
    description: t("viralIdeasPage.ideas.trend.description"),
    source: "TikTok",
    category: t("viralIdeasPage.ideas.trend.category"),
  },
  {
    id: 2,
    title: t("viralIdeasPage.ideas.storytime.title"),
    description: t("viralIdeasPage.ideas.storytime.description"),
    source: "Instagram",
    category: t("viralIdeasPage.ideas.storytime.category"),
  },
  {
    id: 3,
    title: t("viralIdeasPage.ideas.beforeAfter.title"),
    description: t("viralIdeasPage.ideas.beforeAfter.description"),
    source: "YouTube",
    category: t("viralIdeasPage.ideas.beforeAfter.category"),
  },
  {
    id: 4,
    title: t("viralIdeasPage.ideas.quickTip.title"),
    description: t("viralIdeasPage.ideas.quickTip.description"),
    source: "IA",
    category: t("viralIdeasPage.ideas.quickTip.category"),
  },
  {
    id: 5,
    title: t("viralIdeasPage.ideas.imitate.title"),
    description: t("viralIdeasPage.ideas.imitate.description"),
    source: "TikTok",
    category: t("viralIdeasPage.ideas.imitate.category"),
  },
];

function ViralIdeaCard({
  idea,
  isFavorite,
  onFavorite,
  onGenerate,
  t,
}: {
  idea: Idea;
  isFavorite: boolean;
  onFavorite: () => void;
  onGenerate: () => void;
  t: (key: string) => string;
}) {
  return (
    <motion.div
      className="bg-card border border-border rounded-2xl shadow-sm p-6 flex flex-col gap-3 relative group hover:bg-muted/60 transition-colors"
      whileHover={{ y: -6 }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.22 }}
    >
      <button
        onClick={onFavorite}
        className="absolute top-3 right-3"
        title={
          isFavorite
            ? t("viralIdeasPage.removeFavorite")
            : t("viralIdeasPage.addFavorite")
        }
      >
        <motion.span
          initial={false}
          animate={{
            scale: isFavorite ? 1.1 : 1,
            color: isFavorite ? "#e11d48" : "#94a3b8",
          }}
        >
          <Heart fill={isFavorite ? "#e11d48" : "none"} size={22} />
        </motion.span>
      </button>

      <div className="flex items-center gap-2 mb-1">
        <SourceIcon source={idea.source} />
        <span className="text-xs rounded-full px-2 py-0.5 font-semibold bg-primary/10 text-foreground">
          {idea.source}
        </span>
        <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-muted text-foreground/70">
          {idea.category}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Lightbulb className="text-yellow-400" size={18} />
        <h3 className="font-bold text-lg text-foreground">{idea.title}</h3>
      </div>

      <div className="text-sm text-muted-foreground">{idea.description}</div>

      <button
        className="mt-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-2 font-semibold flex items-center justify-center gap-2 shadow-sm transition"
        onClick={onGenerate}
      >
        <Sparkles size={18} /> {t("viralIdeasPage.useIdea")}
      </button>
    </motion.div>
  );
}

function GeneratedModal({
  show,
  onClose,
  ideaTitle,
  t,
}: {
  show: boolean;
  onClose: () => void;
  ideaTitle: string;
  t: (key: string) => string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-card border border-border rounded-2xl p-8 max-w-xs shadow-lg flex flex-col items-center text-foreground"
            initial={{ scale: 0.92, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <CheckCircle className="text-emerald-500 mb-2" size={36} />
            <h4 className="font-bold text-lg mb-2 text-center">
              {t("viralIdeasPage.generatedTitle")}
            </h4>
            <div className="text-muted-foreground mb-4 text-sm text-center">
              {t("viralIdeasPage.generatedDescription")}
              <br />
              <span className="font-semibold text-primary">{ideaTitle}</span>
            </div>
            <button
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl px-4 py-2 mt-2 transition"
              onClick={onClose}
            >
              OK
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function IdeasViralesPage() {
  const t = useT();
  const IDEAS = useIdeas(t);

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
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center bg-background py-10 px-2">
      <div className="w-full max-w-6xl bg-card border border-border rounded-3xl shadow-lg p-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="text-primary" size={28} />
          <h1 className="text-3xl font-bold text-foreground">
            {t("viralIdeasPage.title")}
          </h1>
        </div>
        <p className="mb-8 text-muted-foreground max-w-2xl">
          {t("viralIdeasPage.description")}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-h-[500px] overflow-y-auto pb-4">
          <AnimatePresence>
            {IDEAS.map((idea) => (
              <ViralIdeaCard
                key={idea.id}
                idea={idea}
                isFavorite={favorites.includes(idea.id)}
                onFavorite={() => handleFavorite(idea.id)}
                onGenerate={() => handleGenerate(idea.title)}
                t={t}
              />
            ))}
          </AnimatePresence>
        </div>

        <GeneratedModal
          show={showModal}
          onClose={() => setShowModal(false)}
          ideaTitle={modalIdeaTitle}
          t={t}
        />
      </div>

      <div className="w-full max-w-6xl mx-auto bg-muted border border-border rounded-2xl shadow-sm p-6 mt-10">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-foreground">
          <Heart className="text-red-500" size={20} />{" "}
          {t("viralIdeasPage.favoritesTitle")}
        </h2>

        {favorites.length === 0 ? (
          <p className="text-muted-foreground">{t("viralIdeasPage.noFavorites")}</p>
        ) : (
          <ul className="flex flex-wrap gap-4 mt-2">
            {IDEAS.filter((i) => favorites.includes(i.id)).map((idea) => (
              <li
                key={idea.id}
                className="bg-card border border-border rounded-xl px-4 py-2 shadow-sm flex items-center gap-2"
              >
                <SourceIcon source={idea.source} />
                <span className="font-medium text-foreground">{idea.title}</span>
                <button
                  onClick={() => handleFavorite(idea.id)}
                  className="ml-1 text-xs text-red-400 hover:text-red-600 transition"
                  title={t("viralIdeasPage.removeFavorite")}
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
