const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5177;
const BASE_URL = 'https://api.thenewsapi.com/v1/news/all';

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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'news-reader-proxy' });
});

app.get('/api/news/all', async (req, res) => {
  const token = process.env.THENEWSAPI_TOKEN;

  if (!token) {
    return res.status(500).json({
      message: 'Server token is missing. Set THENEWSAPI_TOKEN in server/.env.'
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

  const params = {
    api_token: token,
    language: 'en',
    limit: 3,
    page
  };

  if (search) {
    params.search = search;
  } else {
    params.categories = categories;
  }

  try {
    const response = await axios.get(BASE_URL, {
      params,
      timeout: 10000
    });

    return res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    let message = 'Unexpected error while fetching news.';

    if (status === 429) {
      message = 'Daily request limit reached. Please try again tomorrow.';
    } else if (status === 401 || status === 403) {
      message = 'TheNewsApi authentication failed. Check your server token.';
    } else if (status >= 500) {
      message = 'The news provider is unavailable right now. Please try again later.';
    }

    return res.status(status).json({
      message,
      status,
      data: []
    });
  }
});

app.listen(PORT, () => {
  console.log(`news-reader proxy running on http://localhost:${PORT}`);
});
