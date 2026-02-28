import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { resolveUrl, siteMetadata, type SeoMetadata } from '@/lib/seo';

interface SeoHeadProps {
  metadata?: SeoMetadata;
  children?: ReactNode;
}

export function SeoHead({ metadata, children }: SeoHeadProps) {
  const data = metadata ?? {};
  const title = data.title ?? siteMetadata.name;
  const description = data.description ?? siteMetadata.description;
  const canonicalUrl = data.canonicalUrl ?? resolveUrl(data.canonicalPath ?? '/');

  const og = {
    title: data.openGraph?.title ?? title,
    description: data.openGraph?.description ?? description,
    url: data.openGraph?.url ?? canonicalUrl,
    type: data.openGraph?.type ?? 'website',
  };

  const keywords = data.keywords ?? siteMetadata.keywords;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:title" content={og.title} />
      <meta property="og:description" content={og.description} />
      <meta property="og:url" content={og.url} />
      <meta property="og:type" content={og.type} />

      {keywords?.length ? <meta name="keywords" content={keywords.join(', ')} /> : null}
      {data.robots && <meta name="robots" content={data.robots} />}

      {data.meta?.map((item) => (
        <meta key={`${item.name}-${item.content}`} name={item.name} content={item.content} />
      ))}

      {children}
    </Helmet>
  );
}
