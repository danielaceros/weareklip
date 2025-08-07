// tailwind.config.ts
import type { Config } from 'tailwindcss';

const accent = {
  blue:   { 50:'#eff6ff', 200:'#bfdbfe', 500:'#3b82f6', 700:'#1d4ed8', 900:'#1e3a8a' },
  green:  { 50:'#ecfdf5', 200:'#bbf7d0', 500:'#10b981', 700:'#047857', 900:'#064e3b' },
  orange: { 50:'#fff7ed', 200:'#fed7aa', 500:'#f97316', 700:'#c2410c', 900:'#7c2d12' },
  rose:   { 50:'#fff1f2', 200:'#fecdd3', 500:'#f43f5e', 700:'#be123c', 900:'#881337' },
};

export default {
  content: ['src/**/*.{ts,tsx}'],

  // @ts-expect-error – Tailwind acepta `safelist` aunque las typings aún no lo incluyan
  safelist: [{ pattern: /^accent-(blue|green|orange|rose)$/ }],

  theme: {
    extend: {
      colors: {
        primary: accent.blue,      // azul por defecto
      },
    },
  },
  plugins: [],
} satisfies Config;
