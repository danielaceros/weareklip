"use client";

import { FC } from "react";

interface IdeasViralesSearchProps {
  query: string;
  setQuery: (value: string) => void;
  onSearch: () => void;
}

export const IdeasViralesSearch: FC<IdeasViralesSearchProps> = ({
  query,
  setQuery,
  onSearch,
}) => {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        placeholder="Buscar por nicho (ej: negocios, fitness...)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 border border-border rounded-lg px-4 py-2 bg-background"
      />
      <button
        onClick={onSearch}
        disabled={!query.trim()}
        className={`px-4 py-2 rounded-lg ${
          query.trim()
            ? "bg-primary text-white hover:bg-primary/80"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        Buscar
      </button>
    </div>
  );
};
