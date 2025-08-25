"use client";

import { FC, useRef } from "react";
import { Heart, X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { ShortVideo } from "./IdeasViralesList";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface IdeasViralesFavoritesProps {
  favorites: ShortVideo[];
  onToggleFavorite: (video: ShortVideo) => void;
}

export const IdeasViralesFavorites: FC<IdeasViralesFavoritesProps> = ({
  favorites,
  onToggleFavorite,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!sliderRef.current) return;
    const scrollAmount = 320; // ancho aprox. de una card
    sliderRef.current.scrollBy({
      left: dir === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="text-red-500 w-5 h-5" />
          Favoritos
        </h2>
        {favorites.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("left")}
              className="h-8 w-8 rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("right")}
              className="h-8 w-8 rounded-full"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Lista */}
      {favorites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tienes vídeos guardados
        </p>
      ) : (
        <div className="relative">
          {/* Fades laterales */}
          
          <div
            ref={sliderRef}
            className="
              flex gap-4 overflow-x-auto scroll-smooth pb-2 
              scrollbar-hide snap-x snap-mandatory
            "
          >
            {favorites.map((video) => (
              <Card
                key={video.id}
                className="
                  flex-shrink-0 w-72 snap-start 
                  border border-border bg-card rounded-xl overflow-hidden
                "
              >
                <div className="relative w-full aspect-video">
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    className="object-cover"
                  />
                </div>

                <CardContent className="p-4">
                  <h4 className="text-sm font-medium line-clamp-2">
                    {video.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {video.channel}
                  </p>
                </CardContent>

                <CardFooter className="flex items-center justify-between gap-2 p-4 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 px-3 text-xs"
                  >
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ver
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggleFavorite(video)}
                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
