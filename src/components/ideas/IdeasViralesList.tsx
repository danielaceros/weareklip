"use client";

import { FC } from "react";
import { Heart, Youtube } from "lucide-react";
import Image from "next/image";

export interface ShortVideo {
  rank: number;
  id: string;
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
  displayCount: number;
  favorites: ShortVideo[];
  onToggleFavorite: (video: ShortVideo) => void;
  onReplicate: (video: ShortVideo) => void;
  viewOnYoutubeText: string;
}

export const IdeasViralesList: FC<IdeasViralesListProps> = ({
  listRef,
  loading,
  filteredVideos,
  displayCount,
  favorites,
  onToggleFavorite,
  onReplicate,
  viewOnYoutubeText,
}) => {
  return (
    <div
      ref={listRef}
      className="bg-card border border-border rounded-2xl shadow-lg p-6 max-h-[500px] overflow-y-auto"
    >
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <ul className="space-y-4">
          {filteredVideos.slice(0, displayCount).map((video, idx) => (
            <li
              key={video.id}
              className="flex items-center gap-4 bg-card border border-border rounded-xl p-4"
            >
              <span className="text-lg font-bold w-8 text-center">{idx + 1}</span>
              <Image
                src={video.thumbnail}
                alt={video.title}
                width={112}
                height={64}
                className="object-cover rounded-lg"
              />
              <div className="flex-1">
                <h3 className="font-semibold line-clamp-2">{video.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {video.channel} • {Number(video.views).toLocaleString()} views
                </p>
              </div>
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-3 py-1 flex items-center gap-1"
              >
                <Youtube size={16} /> {viewOnYoutubeText}
              </a>
              <button
                onClick={() => onToggleFavorite(video)}
                className={`ml-2 ${
                  favorites.some((fav) => fav.id === video.id)
                    ? "text-red-500"
                    : "text-gray-400"
                }`}
              >
                <Heart
                  fill={
                    favorites.some((fav) => fav.id === video.id)
                      ? "currentColor"
                      : "none"
                  }
                  size={20}
                />
              </button>
              <button
                onClick={() => onReplicate(video)}
                className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-3 py-1"
              >
                Replicar vídeo
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
