"use client";

import { FC } from "react";

interface IdeasViralesHeaderProps {
  country: string;
  setCountry: (value: string) => void;
  range: string;
  setRange: (value: string) => void;
  title: string;
}

export const IdeasViralesHeader: FC<IdeasViralesHeaderProps> = ({
  country,
  setCountry,
  range,
  setRange,
  title,
}) => {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <h1 className="text-3xl font-bold">{title}</h1>
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="border border-border rounded-lg px-3 py-1 bg-background"
      >
        <option value="ES">🇪🇸 España</option>
        <option value="US">🇺🇸 USA</option>
        <option value="MX">🇲🇽 México</option>
        <option value="AR">🇦🇷 Argentina</option>
        <option value="FR">🇫🇷 Francia</option>
      </select>
      <select
        value={range}
        onChange={(e) => setRange(e.target.value)}
        className="border border-border rounded-lg px-3 py-1 bg-background"
      >
        <option value="today">📅 Hoy</option>
        <option value="week">🗓 Última semana</option>
        <option value="month">📆 Último mes</option>
        <option value="year">📊 Último año</option>
      </select>
    </div>
  );
};
