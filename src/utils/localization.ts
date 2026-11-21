/**
 * Localization helpers for our *Translation tables.
 *
 * Content (shop/product/category names) is stored in several locales. These
 * helpers convert the raw translation rows into a convenient shape for the API
 * and let callers pick a preferred locale.
 *
 * Shape returned to clients:
 *   {
 *     // all translations, keyed by locale, for editors/admins
 *     translations: { tj: {name, description}, ru: {...}, en: {...} },
 *     // a single resolved value for the requested locale (with fallback)
 *     name: "...", description: "..."
 *   }
 */
import type { Locale } from '@prisma/client';
import { LOCALES } from '../types/common';

interface TranslationRow {
  locale: Locale;
  name: string;
  description?: string | null;
}

export const DEFAULT_LOCALE: Locale = 'tj';

// Order we try when the requested locale has no translation.
const FALLBACK_ORDER: Locale[] = ['tj', 'ru', 'en'];

export function parseLocale(value: unknown): Locale {
  if (typeof value === 'string' && (LOCALES as string[]).includes(value)) {
    return value as Locale;
  }
  return DEFAULT_LOCALE;
}

// Turn an array of translation rows into { translations, name, description }.
export function resolveTranslations<T extends TranslationRow>(rows: T[], preferred: Locale) {
  const byLocale = new Map<Locale, T>();
  for (const row of rows) byLocale.set(row.locale, row);

  // Pick the preferred locale, then fall back through the known order.
  const chosen =
    byLocale.get(preferred) ?? FALLBACK_ORDER.map((l) => byLocale.get(l)).find(Boolean);

  const translations: Partial<Record<Locale, { name: string; description?: string | null }>> = {};
  for (const row of rows) {
    translations[row.locale] = { name: row.name, description: row.description ?? null };
  }

  return {
    translations,
    name: chosen?.name ?? '',
    description: chosen?.description ?? null,
  };
}
