/**
 * Slug helpers.
 *
 * A "slug" is a URL-safe version of a name, e.g. "Fresh Fruits" -> "fresh-fruits".
 * We use slugs in public URLs (shops, categories) so they are readable.
 *
 * Because shop/category names can be in Tajik or Russian (Cyrillic), a slug
 * might end up empty after stripping non-latin characters. In that case we fall
 * back to a short random suffix so the slug is still unique and valid.
 */
import { randomBytes } from 'crypto';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    // keep letters/numbers, turn everything else into a hyphen
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base || `item-${randomBytes(3).toString('hex')}`;
}

// Add a short random suffix to reduce the chance of slug collisions.
export function slugifyUnique(input: string): string {
  return `${slugify(input)}-${randomBytes(3).toString('hex')}`;
}
