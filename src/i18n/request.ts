import { getRequestConfig } from 'next-intl/server';

/**
 * Devuelve mensajes y locale para next-intl.
 * Si no viene locale, cae en 'es'.
 */
export default getRequestConfig(async ({ locale }) => {
  const l = locale ?? 'es';
  return {
    locale: l,
    messages: (await import(`../locales/${l}.json`)).default
  };
});

