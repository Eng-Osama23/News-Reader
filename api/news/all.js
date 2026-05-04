const ALLOWED_CATEGORIES = new Set([
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
]);

module.exports = async (req, res) => {
  const token = process.env.THENEWSAPI_TOKEN;

  if (!token) {
    return res.status(500).json({
      message: 'Server token is missing. Set THENEWSAPI_TOKEN in Vercel project environment variables.'
    });
  }

  const rawPage = Number.parseInt(String(req.query.page || '1'), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const categories = typeof req.query.categories === 'string' ? req.query.categories.trim() : 'tech';

  if (!search && !ALLOWED_CATEGORIES.has(categories)) {
    return res.status(400).json({
      message: `Invalid category "${categories}".`
    });
  }

  const params = new URLSearchParams({
    api_token: token,
    language: 'en',
    limit: '3',
    page: String(page)
  });

  if (search) {
    params.set('search', search);
  } else {
    params.set('categories', categories);
  }

  const upstreamUrl = `https://api.thenewsapi.com/v1/news/all?${params.toString()}`;

  try {
    const response = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      let message = 'Unexpected error while fetching news.';

      if (response.status === 429) {
        message = 'Daily request limit reached. Please try again tomorrow.';
      } else if (response.status === 401 || response.status === 403) {
        message = 'TheNewsApi authentication failed. Check your server token.';
      } else if (typeof body?.message === 'string') {
        message = body.message;
      }

      return res.status(response.status).json({
        message,
        status: response.status,
        data: []
      });
    }

    return res.status(200).json(body);
  } catch (_error) {
    return res.status(500).json({
      message: 'Unable to reach the news provider right now.',
      status: 500,
      data: []
    });
  }
};
