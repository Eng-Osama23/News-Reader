export const CATEGORIES = [
  'tech',
  'general',
  'science',
  'sports',
  'business',
  'health',
  'entertainment',
  'politics',
  'food',
  'travel'
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface NewsArticle {
  uuid?: string;
  title: string;
  description?: string;
  snippet?: string;
  url?: string;
  image_url?: string;
  source?: string;
  published_at?: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface FetchNewsParams {
  page: number;
  category: Category;
  search: string;
}

export async function fetchNewsPage({ page, category, search }: FetchNewsParams): Promise<NewsArticle[]> {
  const params = new URLSearchParams();
  params.set('page', String(page));

  if (search.trim()) {
    params.set('search', search.trim());
  } else {
    params.set('categories', category);
  }

  const proxiedUrl = `/api/news/all?${params.toString()}`;

  // Debug logging intentionally avoids secrets because the browser only sees proxied routes.
  console.debug('[news-reader] requesting', proxiedUrl);

  const response = await fetch(proxiedUrl);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : 'Failed to fetch news.';
    throw new ApiError(response.status, message);
  }

  return Array.isArray(payload?.data) ? payload.data : [];
}
