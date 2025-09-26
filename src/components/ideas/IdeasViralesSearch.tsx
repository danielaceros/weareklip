"use client";

import { FC, useCallback } from "react";
import { useT } from "@/lib/i18n";
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
  const t = useT();

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && query.trim()) onSearch();
    },
    [onSearch, query]
  );

  return (
    <div className="flex flex-col sm:flex-row w-full gap-2">
      <Input
        type="text"
        placeholder={t("ideas.search.placeholder")}
        aria-label={t("ideas.search.placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full sm:flex-1 rounded-lg bg-muted text-sm focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button
        onClick={onSearch}
        disabled={!query.trim()}
        className="w-full sm:w-auto rounded-lg px-6"
      >
        {t("ideas.search.button")}
      </Button>
    </div>
  );
};
