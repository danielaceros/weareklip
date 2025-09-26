"use client";

import { FC } from "react";
import { useT } from "@/lib/i18n";
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
  const t = useT();

  const countryLabel = (code: string) =>
    t(`ideas.header.countries.${code}`) || code;

  const rangeLabel = (r: string) => {
    if (r === "today") return t("ideas.header.ranges.today");
    if (r === "week") return t("ideas.header.ranges.week");
    if (r === "month") return t("ideas.header.ranges.month");
    if (r === "year") return t("ideas.header.ranges.year");
    return r;
  };

  return (
    <div className="space-y-4">
      {/* 📌 Título */}
      <h1 className="text-2xl font-bold">{title}</h1>

      {/* 📌 Filtros */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        {/* Idioma */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto rounded-lg text-sm font-medium"
            >
              {t("ideas.header.language")}: {countryLabel(country)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40">
            <DropdownMenuItem onClick={() => setCountry("ES")}>
              🇪🇸 {countryLabel("ES")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCountry("US")}>
              🇺🇸 {countryLabel("US")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCountry("MX")}>
              🇲🇽 {countryLabel("MX")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCountry("AR")}>
              🇦🇷 {countryLabel("AR")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCountry("FR")}>
              🇫🇷 {countryLabel("FR")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tiempo */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto rounded-lg text-sm font-medium"
            >
              {t("ideas.header.time")}: {rangeLabel(range)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-44">
            <DropdownMenuItem onClick={() => setRange("today")}>
              📅 {t("ideas.header.ranges.today")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRange("week")}>
              🗓 {t("ideas.header.ranges.week")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRange("month")}>
              📆 {t("ideas.header.ranges.month")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setRange("year")}>
              📊 {t("ideas.header.ranges.year")}
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
              "w-full sm:w-auto rounded-lg text-sm font-medium",
              favoritesOnly && "bg-primary text-white"
            )}
          >
            {t("ideas.favorites.toggle")}
          </Button>
        )}
      </div>
    </div>
  );
};
