"use client";

import { FC } from "react";
import { Heart, X } from "lucide-react";
import Image from "next/image";
import { ShortVideo } from "./IdeasViralesList";

interface IdeasViralesFavoritesProps {
  favorites: ShortVideo[];
  onToggleFavorite: (video: ShortVideo) => void;
}

export const IdeasViralesFavorites: FC<IdeasViralesFavoritesProps> = ({
  favorites,
  onToggleFavorite,
}) => {
  return (
    <div className="bg-muted border border-border rounded-2xl shadow-sm p-6">
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
        <Heart className="text-red-500" size={20} /> Favoritos
      </h2>
      {favorites.length === 0 ? (
        <p className="text-muted-foreground">No tienes vídeos guardados</p>
      ) : (
        <ul className="space-y-2">
          {favorites.map((video) => (
            <li
              key={video.id}
              className="flex items-center gap-3 bg-card border border-border rounded-lg p-3"
            >
              <Image
                src={video.thumbnail}
                alt={video.title}
                width={80}
                height={48}
                className="object-cover rounded-md"
              />
              <div className="flex-1">
                <h4 className="font-medium line-clamp-1">{video.title}</h4>
                <p className="text-xs text-muted-foreground">{video.channel}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 hover:underline text-sm"
                >
                  Ver
                </a>
                <button
                  onClick={() => onToggleFavorite(video)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
