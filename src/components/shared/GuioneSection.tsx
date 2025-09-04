// src/components/shared/guionesection.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/shared/EmptyState";
import { useTranslations } from "next-intl";

type Guion = {
  firebaseId: string;
  titulo: string;
  contenido: string;
  estado: number;
};

type Props = {
  guiones: Guion[];
  setModalOpen: (open: boolean) => void;
  onCreate: (titulo: string, contenido: string) => void;
  onSelect: (guion: Guion) => void;
  modalOpen: boolean;
};

export default function GuionesSection({
  guiones,
  onCreate,
  onSelect,
  modalOpen,
  setModalOpen,
}: Props) {
  const t = useTranslations("clientGuionesSection");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");

  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");

  const estados: Record<number, React.ReactNode> = {
    0: <Badge className="bg-red-500 text-white">🆕 {tStatus("new")}</Badge>,
    1: (
      <Badge className="bg-yellow-400 text-black">✏️ {tStatus("changes")}</Badge>
    ),
    2: <Badge className="bg-green-500 text-white">✅ {tStatus("approved")}</Badge>,
  };

  const handleSubmit = () => {
    if (!titulo.trim() || !contenido.trim()) return;
    onCreate(titulo.trim(), contenido.trim());
    setTitulo("");
    setContenido("");
    setModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">📜 {t("title")}</h2>
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogTrigger asChild>
            <Button variant="default">+ {t("create")}</Button>
          </DialogTrigger>
          <DialogContent className="space-y-3">
            <Input
              placeholder={t("placeholders.title")}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              aria-label={t("placeholders.title")}
            />
            <Textarea
              placeholder={t("placeholders.content")}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              aria-label={t("placeholders.content")}
            />
            <Button onClick={handleSubmit} className="w-full">
              {t("save")}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {guiones.length === 0 ? (
        <EmptyState>
          <p className="text-muted-foreground">📜 {t("empty.title")}</p>
          <p className="mt-2 text-sm">
            → {t("empty.hint")}{" "}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalOpen(true)}
              className="hover:bg-primary hover:text-primary-foreground"
            >
              + {t("create")}
            </Button>
          </p>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {guiones.map((g) => (
            <Card
              key={g.firebaseId}
              className="p-3 cursor-pointer relative group transition hover:shadow-md focus-within:ring-2 focus-within:ring-primary"
              onClick={() => onSelect(g)}
              tabIndex={0}
              role="button"
              aria-label={t("a11y.selectScript", { title: g.titulo })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(g);
              }}
            >
              {/* Badge de estado en esquina */}
              <div className="absolute top-2 right-2">
                {g.estado !== undefined
                  ? estados[g.estado] ?? (
                      <Badge variant="secondary">{tCommon("unknown")}</Badge>
                    )
                  : null}
              </div>

              <p className="font-semibold text-base truncate mb-1">
                {g.titulo}
              </p>
              <p className="text-muted-foreground text-sm whitespace-pre-line line-clamp-5">
                {g.contenido}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

