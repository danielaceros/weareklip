"use client";

import { FC, useState } from "react";
import { Heart, X } from "lucide-react";
import Image from "next/image";
import { ShortVideo } from "./IdeasViralesList";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

interface IdeasViralesFavoritesProps {
  favorites: ShortVideo[];
  onToggleFavorite: (video: ShortVideo) => void;
}

export const IdeasViralesFavorites: FC<IdeasViralesFavoritesProps> = ({
  favorites,
  onToggleFavorite,
}) => {
  const [page, setPage] = useState(1);

  const itemsPerPage = typeof window !== "undefined" && window.innerWidth < 640 ? 2 : 3;
  const totalPages = Math.ceil(favorites.length / itemsPerPage);

  const currentFavorites = favorites.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, "…", totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "…", page - 1, page, page + 1, "…", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="text-red-500 w-5 h-5" />
          Favoritos
        </h2>
      </div>

      {/* Lista */}
      {favorites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes vídeos guardados</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentFavorites.map((video) => (
              <Card
                key={video.id}
                className="w-full border border-border bg-card rounded-xl overflow-hidden flex flex-col"
              >
                <div className="relative w-full aspect-video">
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    className="object-cover"
                  />
                </div>

                <CardContent className="p-3 flex-1">
                  <h4 className="text-sm font-medium line-clamp-2">{video.title}</h4>
                  <p className="text-xs text-muted-foreground">{video.channel}</p>
                </CardContent>

                <CardFooter className="flex items-center justify-between gap-2 p-3 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 px-3 text-xs w-full sm:w-auto"
                  >
                    <a href={video.url} target="_blank" rel="noopener noreferrer">
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

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page > 1) setPage(page - 1);
                      }}
                      className="cursor-pointer"
                    />
                  </PaginationItem>

                  {getPageNumbers().map((p, idx) =>
                    typeof p === "number" ? (
                      <PaginationItem key={idx}>
                        <PaginationLink
                          href="#"
                          isActive={p === page}
                          onClick={(e) => {
                            e.preventDefault();
                            setPage(p);
                          }}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={idx}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )
                  )}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (page < totalPages) setPage(page + 1);
                      }}
                      className="cursor-pointer"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
    </div>
  );
};
