import { useEffect } from 'react'
import { REPO_URL, SITE_URL, useI18n } from '@/lib/i18n'

function upsertMeta({
  name,
  property,
  content,
}: {
  name?: string
  property?: string
  content: string
}) {
  const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = document.createElement('meta')
    if (name) element.setAttribute('name', name)
    if (property) element.setAttribute('property', property)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

function upsertLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`

  let element = document.head.querySelector<HTMLLinkElement>(selector)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    if (hreflang) element.setAttribute('hreflang', hreflang)
    document.head.appendChild(element)
  }

  element.setAttribute('href', href)
}

function upsertStructuredData(id: string, data: unknown) {
  let script = document.head.querySelector<HTMLScriptElement>(`script#${id}`)
  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = id
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify(data)
}

export function useSeo() {
  const { language, t } = useI18n()

  useEffect(() => {
    const currentUrl = new URL(window.location.href)
    currentUrl.hash = ''

    document.title = t.meta.title

    upsertMeta({ name: 'description', content: t.meta.description })
    upsertMeta({ name: 'keywords', content: t.meta.keywords })
    upsertMeta({ name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' })
    upsertMeta({ name: 'googlebot', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' })
    upsertMeta({ name: 'author', content: 'rokartur' })
    upsertMeta({ name: 'language', content: language })
    upsertMeta({ name: 'application-name', content: 'Polish Complete Filters Tester' })
    upsertMeta({ name: 'apple-mobile-web-app-title', content: 'PCF Tester' })
    upsertMeta({ name: 'theme-color', content: '#050508' })
    upsertMeta({ property: 'og:type', content: 'website' })
    upsertMeta({ property: 'og:site_name', content: 'Polish Complete Filters' })
    upsertMeta({ property: 'og:locale', content: t.meta.locale })
    upsertMeta({ property: 'og:title', content: t.meta.socialTitle })
    upsertMeta({ property: 'og:description', content: t.meta.socialDescription })
    upsertMeta({ property: 'og:url', content: currentUrl.toString() })
    upsertMeta({ name: 'twitter:card', content: 'summary' })
    upsertMeta({ name: 'twitter:title', content: t.meta.socialTitle })
    upsertMeta({ name: 'twitter:description', content: t.meta.socialDescription })

    const ogImage = document.head.querySelector('meta[property="og:image"]')
    const ogImageAlt = document.head.querySelector('meta[property="og:image:alt"]')
    const twitterImage = document.head.querySelector('meta[name="twitter:image"]')

    ogImage?.remove()
    ogImageAlt?.remove()
    twitterImage?.remove()

    upsertLink('canonical', currentUrl.toString())

    upsertStructuredData('pcf-structured-data', [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Polish Complete Filters Tester',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        inLanguage: language,
        url: currentUrl.toString(),
        description: t.meta.description,
        browserRequirements: 'Requires a modern browser with Fetch API and Performance API support.',
        featureList: t.seo.features.map((item) => item.title),
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        publisher: {
          '@type': 'Organization',
          name: 'Polish Complete Filters',
          url: SITE_URL,
          sameAs: [REPO_URL],
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        inLanguage: language,
        mainEntity: t.seo.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ])
  }, [language, t])
}
