"use client";

import { FC } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IdeasViralesHeaderProps {
  country: string;
  setCountry: (value: string) => void;
  range: string;
  setRange: (value: string) => void;
  title: string;
  favoritesOnly?: boolean;
  setFavoritesOnly?: (value: boolean) => void;
}

export const IdeasViralesHeader: FC<IdeasViralesHeaderProps> = ({
  country,
  setCountry,
  range,
  setRange,
  title,
  favoritesOnly,
  setFavoritesOnly,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-bold">Mis Ideas</h1>
      <div className="flex justify-between"></div>
      <div className="flex flex-wrap gap-3">
        {/* Idioma */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-sm font-medium"
            >
              Idioma:{" "}
              {country === "ES"
                ? "Español"
                : country === "US"
                ? "Inglés"
                : country}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40">
            <DropdownMenuItem onClick={() => setCountry("ES")}>
              🇪🇸 Español
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCountry("US")}>
              🇺🇸 Inglés
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCountry("MX")}>
              🇲🇽 México
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCountry("AR")}>
              🇦🇷 Argentina
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCountry("FR")}>
              🇫🇷 Francés
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tiempo */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-sm font-medium"
            >
              Tiempo:{" "}
              {range === "today"
                ? "Hoy"
                : range === "week"
                ? "Última semana"
                : range === "month"
                ? "Último mes"
                : "Último año"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            <DropdownMenuItem onClick={() => setRange("today")}>
              📅 Hoy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRange("week")}>
              🗓 Última semana
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRange("month")}>
              📆 Último mes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRange("year")}>
              📊 Último año
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Favoritos */}
        {setFavoritesOnly && (
          <Button
            variant={favoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={cn(
              "rounded-lg text-sm font-medium",
              favoritesOnly && "bg-primary text-white"
            )}
          >
            Favoritos
          </Button>
        )}
      </div>
    </div>
  );
};
