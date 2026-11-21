/**
 * Small shared types used across modules.
 */
import type { Locale } from '@prisma/client';

export const LOCALES: Locale[] = ['tj', 'ru', 'en'];

// Shape used by every module that accepts translated name/description input.
export interface TranslationInput {
  locale: Locale;
  name: string;
  description?: string | null;
}
