"use client";

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FilePlus2,
  Music2,
  Clapperboard,
  Scissors,
  Sparkles,
} from "lucide-react";

/** Ajusta aquí las rutas si en tu app son otras */
const ROUTES = {
  generarGuion: "/dashboard/script?new=1",
  nuevoAudio: "/dashboard/audio?new=1",
  crearVideo: "/dashboard/video?new=1",
  editarVideo: "/dashboard/edit?new=1",
};

export default function QuickActionsCard() {
  return (
    <Card className="h-full">
      {/* Título con icono y tamaño como las otras cards */}
      <CardHeader className="pb-0">
        <h2 className="font-semibold text-base lg:text-lg mb-2 flex items-center gap-2">
          <Sparkles className="size-5 text-muted-foreground" aria-hidden />
          <span>Acciones rápidas</span>
        </h2>
        <CardDescription>Empieza en un clic</CardDescription>
      </CardHeader>

      {/* 🔻 Botones: sin cambios */}
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 justify-start text-base"
          >
            <Link href={ROUTES.generarGuion}>
              <FilePlus2 className="mr-2 h-5 w-5" />
              Generar guion
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 justify-start text-base"
          >
            <Link href={ROUTES.nuevoAudio}>
              <Music2 className="mr-2 h-5 w-5" />
              Nuevo audio
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 justify-start text-base"
          >
            <Link href={ROUTES.crearVideo}>
              <Clapperboard className="mr-2 h-5 w-5" />
              Crear vídeo
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-14 justify-start text-base"
          >
            <Link href={ROUTES.editarVideo}>
              <Scissors className="mr-2 h-5 w-5" />
              Editar vídeo
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

