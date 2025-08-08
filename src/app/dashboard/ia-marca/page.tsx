"use client";

import { useState } from "react";
import { Volume2, Users2, Globe2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type BrandDNA = {
  tone: string;
  audience: string;
  values: string[];
  website: string;
  networks: string;
};

const DEFAULT: BrandDNA = {
  tone: "",
  audience: "",
  values: [],
  website: "",
  networks: "",
};

const EXAMPLES = {
  tone: [
    "Profesional",
    "Divertido",
    "Cercano",
    "Inspirador",
    "Formal",
    "Joven",
    "Informal",
    "Académico",
  ],
  values: [
    "Innovación",
    "Empatía",
    "Confianza",
    "Transparencia",
    "Creatividad",
    "Sostenibilidad",
    "Calidad",
    "Cercanía",
    "Inclusión",
  ],
};

export default function IAdeMarcaPage() {
  const [form, setForm] = useState<BrandDNA>(DEFAULT);
  const [newValue, setNewValue] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Añadir valor
  const addValue = (v?: string) => {
    const value = (v || newValue).trim();
    if (value && !form.values.includes(value)) {
      setForm({ ...form, values: [...form.values, value] });
      setNewValue("");
    }
  };

  // Eliminar valor
  const removeValue = (value: string) => {
    setForm({ ...form, values: form.values.filter((v) => v !== value) });
  };

  // Simula guardar datos
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 1800);
    // Aquí harías un POST a la API
  };

  return (
    <div className="min-h-[85vh] flex flex-col items-center bg-gradient-to-br from-violet-50 to-blue-50 py-10 px-2">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lg p-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="text-blue-500" size={28} />
          <h1 className="text-3xl font-bold">IA de Marca</h1>
        </div>
        <p className="mb-7 text-gray-600 max-w-lg">
          Completa tu ADN de marca.
          <br />
          Así generaremos guiones totalmente personalizados para ti.
        </p>

        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          {/* Tono de voz */}
          <div>
            <label className="flex items-center gap-2 font-semibold mb-2 text-base">
              <Volume2 className="text-blue-400" size={20} />
              Tono de voz
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {EXAMPLES.tone.map((tone) => (
                <button
                  type="button"
                  key={tone}
                  className={`px-3 py-1 rounded-full border ${
                    form.tone === tone
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-gray-100 border-gray-300 text-gray-600"
                  } text-xs font-medium hover:bg-blue-100 transition`}
                  onClick={() => setForm({ ...form, tone })}
                >
                  {tone}
                </button>
              ))}
            </div>
            <input
              type="text"
              name="tone"
              value={form.tone}
              onChange={handleChange}
              placeholder="Ej: Cercano, Profesional, Inspirador..."
              className="border rounded-lg px-4 py-2 w-full"
            />
          </div>

          {/* Público objetivo */}
          <div>
            <label className="flex items-center gap-2 font-semibold mb-2 text-base">
              <Users2 className="text-pink-400" size={20} />
              Público objetivo
            </label>
            <input
              type="text"
              name="audience"
              value={form.audience}
              onChange={handleChange}
              placeholder="Ej: Jóvenes creativos, Empresas tecnológicas..."
              className="border rounded-lg px-4 py-2 w-full"
            />
          </div>

          {/* Valores clave */}
          <div>
            <label className="flex items-center gap-2 font-semibold mb-2 text-base">
              <Sparkles className="text-yellow-500" size={20} />
              Valores clave
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.values.map((val) => (
                <span
                  key={val}
                  className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1"
                >
                  {val}
                  <button
                    type="button"
                    onClick={() => removeValue(val)}
                    className="ml-1 text-blue-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {EXAMPLES.values.map(
                (v) =>
                  !form.values.includes(v) && (
                    <button
                      type="button"
                      key={v}
                      className="bg-gray-100 border border-gray-300 rounded-full px-3 py-1 text-xs text-gray-600 hover:bg-blue-100"
                      onClick={() => addValue(v)}
                    >
                      {v}
                    </button>
                  )
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Añadir valor propio"
                className="border rounded-lg px-3 py-2 flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addValue();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => addValue()}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl text-sm"
              >
                Añadir
              </button>
            </div>
          </div>

          {/* Web y redes */}
          <div>
            <label className="flex items-center gap-2 font-semibold mb-2 text-base">
              <Globe2 className="text-green-400" size={20} />
              Sitio web / Redes sociales
            </label>
            <input
              type="text"
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder="Ej: www.tumarca.com"
              className="border rounded-lg px-4 py-2 w-full mb-2"
            />
            <input
              type="text"
              name="networks"
              value={form.networks}
              onChange={handleChange}
              placeholder="Redes sociales (Instagram, TikTok, etc.)"
              className="border rounded-lg px-4 py-2 w-full"
            />
          </div>

          {/* Botón guardar */}
          <motion.button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-2xl shadow mt-3 transition text-lg"
            whileTap={{ scale: 0.97 }}
          >
            Guardar ADN de marca
          </motion.button>
        </form>

        {/* Animación feedback de éxito */}
        <motion.div
          initial={false}
          animate={
            success
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.8, y: 10 }
          }
          className="fixed top-12 left-1/2 -translate-x-1/2 bg-green-500 text-white font-semibold px-6 py-3 rounded-2xl shadow-lg z-50"
        >
          ¡ADN de marca guardado!
        </motion.div>
      </div>
    </div>
  );
}
