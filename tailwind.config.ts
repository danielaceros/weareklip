// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{ts,tsx,js,jsx,mdx}',
    './public/**/*.html',
  ],

  // Mantén un safelist para las clases de acento que aplicas al <html>
  // así no se pierden en builds donde no aparezcan en el markup escaneado.
  // @ts-expect-error - Tailwind acepta `safelist` aunque las typings no lo incluyan en v4
  safelist: [{ pattern: /^accent-(blue|green|orange|rose)$/ }],

  theme: {
    extend: {
      // No definimos colores aquí porque ya usas CSS variables en globals.css:
      // --primary, --accent, --ring, etc. (mapeadas por @theme inline)
      // Si defines "colors.primary" aquí, podrías sobreescribir el sistema por variables.
    },
  },
  plugins: [],
} satisfies Config;
