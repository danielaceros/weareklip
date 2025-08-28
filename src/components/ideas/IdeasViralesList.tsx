"use client";

import { FC, useState } from "react";
import { Heart } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

export interface ShortVideo {
  rank: number;
  id: string; // YouTube Video ID
  title: string;
  channel: string;
  views: string;
  url: string;
  thumbnail: string;
  description: string;
  publishedAt: string;
}

interface IdeasViralesListProps {
  listRef: React.RefObject<HTMLDivElement | null>;
  loading: boolean;
  filteredVideos: ShortVideo[];
  favorites: ShortVideo[];
  onToggleFavorite: (video: ShortVideo) => void;
  onReplicate: (video: ShortVideo) => void;
  viewOnYoutubeText: string;
}

/** Player ligero: muestra thumbnail y sólo monta el iframe nocookie al hacer click */
const VideoThumbEmbed: FC<{
  videoId: string;
  title: string;
  thumbnail: string;
  className?: string;
}> = ({ videoId, title, thumbnail, className = "" }) => {
  const [active, setActive] = useState(false);
  const embed = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <div className={`relative w-full aspect-video overflow-hidden bg-black ${className}`}>
      {!active && (
        <button
          type="button"
          aria-label={`Reproducir: ${title}`}
          onClick={() => setActive(true)}
          className="group absolute inset-0 grid place-items-center"
        >
          <Image
            src={thumbnail}
            alt={title}
            fill
            loading="lazy"
            className="object-cover opacity-90 transition group-hover:opacity-100"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <span className="absolute grid place-items-center rounded-full px-4 py-3 bg-white/90 backdrop-blur text-black text-sm font-semibold shadow-lg transition group-hover:scale-105">
            ▶ Ver aquí
          </span>
        </button>
      )}

      {active && (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={embed}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
};

export const IdeasViralesList: FC<IdeasViralesListProps> = ({
  listRef,
  loading,
  filteredVideos,
  favorites,
  onToggleFavorite,
  onReplicate,
  viewOnYoutubeText,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  const totalPages = Math.ceil(filteredVideos.length / itemsPerPage);
  const currentVideos = filteredVideos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "…", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "…", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages);
      }
    }
    return pages;
  };

  return (
    <div ref={listRef} className="w-full">
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Grid de videos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentVideos.map((video) => {
              const isFav = favorites.some((fav) => fav.id === video.id);
              return (
                <Card
                  key={video.id}
                  className="overflow-hidden border border-border rounded-xl bg-card flex flex-col"
                >
                  {/* Embed dentro del SaaS: youtube-nocookie + lazy */}
                  <VideoThumbEmbed
                    videoId={video.id}
                    title={video.title}
                    thumbnail={video.thumbnail}
                  />

                  <CardContent className="p-4 flex-1">
                    <h3 className="font-semibold text-sm line-clamp-2">
                      {video.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {video.channel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Number(video.views).toLocaleString()} views
                    </p>
                  </CardContent>

                  <CardFooter className="flex items-center justify-between p-4 pt-0">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="rounded-lg"
                      >
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {viewOnYoutubeText}
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-lg"
                        onClick={() => onReplicate(video)}
                      >
                        Replicar video
                      </Button>
                    </div>

                    <button
                      onClick={() => onToggleFavorite(video)}
                      className={`p-2 rounded-full transition ${
                        isFav
                          ? "text-red-500 hover:text-red-600"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Heart
                        size={20}
                        fill={isFav ? "currentColor" : "none"}
                      />
                    </button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(currentPage - 1);
                      }}
                      className="cursor-pointer"
                    />
                  </PaginationItem>

                  {getPageNumbers().map((page, idx) =>
                    typeof page === "number" ? (
                      <PaginationItem key={idx}>
                        <PaginationLink
                          href="#"
                          isActive={page === currentPage}
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          className="cursor-pointer"
                        >
                          {page}
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
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
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
