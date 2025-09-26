"use client";

import { useState } from "react";
import { LipsyncVideoCard } from "./LipsyncVideoCard";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useT } from "@/lib/i18n";

export interface VideoData {
  projectId: string;
  title: string; // obligatorio
  status: string;
  downloadUrl?: string;
  duration?: number;
}

interface LipsyncVideoListProps {
  videos: VideoData[];
  perPage?: number;
  onDelete: (id: string, url?: string) => void;
}

export function LipsyncVideoList({
  videos,
  perPage = 5,
  onDelete,
}: LipsyncVideoListProps) {
  const t = useT();
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(videos.length / perPage) || 1;
  const paginated = videos.slice((page - 1) * perPage, page * perPage);

  if (videos.length === 0) return <p>{t("lipsyncList.empty")}</p>;

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Grid dinámico */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {paginated.map((video) => (
          <LipsyncVideoCard
            key={video.projectId}
            video={video}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="mt-auto">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage(page - 1);
                  }}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => (
                <PaginationItem key={i}>
                  <PaginationLink
                    href="#"
                    isActive={page === i + 1}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(i + 1);
                    }}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) setPage(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
