export interface StructuredDataInput {
  /** The public origin (`SITE_URL`), empty when it was not set at build time. */
  siteUrl: string;
  locale: string;
  name: string;
  description: string;
  faq: { question: string; answer: string }[];
}

/** The public origin without the trailing slashes (empty when it was not set). */
export function originOf(siteUrl: string): string {
  let end = siteUrl.length;
  while (end > 0 && siteUrl[end - 1] === '/') end -= 1;
  return siteUrl.slice(0, end);
}

/** The path of the landing in a language: English at `/`, Portuguese under `/pt-BR`. */
export function landingPath(locale: string): string {
  return locale === 'en' ? '/' : `/${locale}`;
}

/**
 * The structured data of the landing (schema.org): the application and the questions. The URL is
 * left out when the origin is unknown, because it has to be absolute.
 */
export function landingStructuredData(input: StructuredDataInput) {
  const origin = originOf(input.siteUrl);
  const application: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    name: input.name,
    description: input.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: input.locale,
  };
  if (origin) application.url = `${origin}${landingPath(input.locale)}`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      application,
      {
        '@type': 'FAQPage',
        mainEntity: input.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  };
}
