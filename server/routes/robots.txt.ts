import { originOf } from '../../app/utils/landing';

/**
 * `robots.txt`, prerendered with the origin of the build (`SITE_URL`) so it can point at the
 * sitemap. The logged in app is a client-only SPA with no content to index: the pages that need
 * a session send the visitor to the login, and `noindex` on that page keeps it out.
 */
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');
  const origin = originOf(process.env.SITE_URL ?? '');
  const lines = ['User-Agent: *', 'Disallow:'];
  if (origin) lines.push('', `Sitemap: ${origin}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
});
