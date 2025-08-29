"use client";

import { FC } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col sm:flex-row w-full gap-2">
      <Input
        type="text"
        placeholder="Busca tu nicho"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full sm:flex-1 rounded-lg bg-muted text-sm focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button
        onClick={onSearch}
        disabled={!query.trim()}
        className="w-full sm:w-auto rounded-lg px-6"
      >
        Buscar
      </Button>
    </div>
  );
};
