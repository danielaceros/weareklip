"use client";

import React from "react";
import "@/styles/table-styles.css"; // estilos completos unificados

const tabs = ["All", "Emoji", "New", "Trend", "Premium", "Speakers", "Custom"];

// Lista de TODOS los templates disponibles
const templates = [
  { name: "Doug", className: "button-template-doug", tag: "New" },
  { name: "Carlos", className: "button-template-carlos", tag: "New" },
  { name: "Luke", className: "button-template-luke", tag: "New" },
  { name: "Mark", className: "button-template-mark" },
  { name: "Kelly", className: "button-template-kelly" },
  { name: "Lewis", className: "button-template-lewis" },
  { name: "Kendrick", className: "button-template-kendrick" },
  { name: "Sara", className: "button-template-sara" },
  { name: "Daniel", className: "button-template-daniel" },
  { name: "Dan 2", className: "button-template-dan2" },
  { name: "Hormozi 4", className: "button-template-hormozi4" },
  { name: "Dan", className: "button-template-dan" },
  { name: "Devin", className: "button-template-devin" },
  { name: "Tayo", className: "button-template-tayo" },
  { name: "Ella", className: "button-template-ella" },
  { name: "Tracy", className: "button-template-tracy" },
  { name: "Hormozi 1", className: "button-template-hormozi1" },
  { name: "Hormozi 2", className: "button-template-hormozi2" },
  { name: "Hormozi 3", className: "button-template-hormozi3" },
  { name: "Hormozi 5", className: "button-template-hormozi5" },
  { name: "William", className: "button-template-william" },
  { name: "Leon", className: "button-template-leon" },
  { name: "Ali", className: "button-template-ali" },
  { name: "Beast", className: "button-template-beast" },
  { name: "Maya", className: "button-template-maya" },
  { name: "Karl", className: "button-template-karl" },
  { name: "Iman", className: "button-template-iman" },
  { name: "David", className: "button-template-david" },
  { name: "Noah", className: "button-template-noah" },
  { name: "Gstaad", className: "button-template-gstaad" },
  { name: "Nema", className: "button-template-nema" },
  { name: "ROSA", className: "button-template-rosa" },
];


export default function TablePreview() {
  return (
    <div className="w-full rounded-2xl bg-white shadow-md p-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            className={`tab-button ${idx === 0 ? "active" : ""}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Grid de templates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {templates.map((tpl, idx) => (
          <div key={idx} className="template-card">
            <button className={`${tpl.className} truncate`}>
              <div className="button-template-name" data-text={tpl.name}>
                {tpl.name}
              </div>
            </button>
            {tpl.tag && <p className="tag">{tpl.tag}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
