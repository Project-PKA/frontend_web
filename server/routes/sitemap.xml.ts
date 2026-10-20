import { landingPath, originOf } from '../../app/utils/landing';

const LOCALES = ['en', 'pt-BR'];

/**
 * The sitemap of the public pages, prerendered with the origin of the build (`SITE_URL`). Each
 * language of the landing points at the others (`hreflang`). Without the origin there is nothing
 * absolute to list, so the sitemap is empty.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  const origin = originOf(process.env.SITE_URL ?? '');

  const urls = origin
    ? LOCALES.map((locale) => {
        const alternates = LOCALES.map(
          (other) =>
            `    <xhtml:link rel="alternate" hreflang="${other}" href="${origin}${landingPath(other)}"/>`,
        ).join('\n');
        return `  <url>\n    <loc>${origin}${landingPath(locale)}</loc>\n${alternates}\n  </url>`;
      })
    : [];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
});
