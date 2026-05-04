import { useEffect, useMemo, useRef, useState } from 'react';
import { HeadlinesList } from './components/HeadlinesList';
import {
  ApiError,
  CATEGORIES,
  type Category,
  type NewsArticle,
  fetchNewsPage
} from './lib/newsapi';

type ViewMode = 'live' | 'favorites';

function makeFavoriteKey(article: NewsArticle): string {
  return article.uuid || article.url || article.title;
}

function loadFavorites(): NewsArticle[] {
  try {
    const raw = localStorage.getItem('news-reader:favorites');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('tech');

  const [page, setPage] = useState(1);
  const [indexInPage, setIndexInPage] = useState(0);
  const [items, setItems] = useState<NewsArticle[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [favorites, setFavorites] = useState<NewsArticle[]>(() => loadFavorites());

  const pageCacheRef = useRef<Map<string, NewsArticle[]>>(new Map());
  const requestCacheRef = useRef<Map<string, Promise<NewsArticle[]>>>(new Map());

  const activeSearch = searchInput.trim();
  const queryKey = useMemo(
    () => (activeSearch ? `search:${activeSearch.toLowerCase()}` : `category:${selectedCategory}`),
    [activeSearch, selectedCategory]
  );

  const favoritesMap = useMemo(() => {
    const map = new Map<string, NewsArticle>();
    favorites.forEach((article) => map.set(makeFavoriteKey(article), article));
    return map;
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('news-reader:favorites', JSON.stringify(favorites));
  }, [favorites]);

  function keyForPage(targetPage: number): string {
    return `${queryKey}|${targetPage}`;
  }

  async function getPage(targetPage: number): Promise<NewsArticle[]> {
    const cacheKey = keyForPage(targetPage);

    const cached = pageCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = requestCacheRef.current.get(cacheKey);
    if (pending) {
      return pending;
    }

    const request = fetchNewsPage({
      page: targetPage,
      category: selectedCategory,
      search: activeSearch
    })
      .then((nextItems) => {
        pageCacheRef.current.set(cacheKey, nextItems);
        requestCacheRef.current.delete(cacheKey);
        return nextItems;
      })
      .catch((requestError) => {
        requestCacheRef.current.delete(cacheKey);
        throw requestError;
      });

    requestCacheRef.current.set(cacheKey, request);
    return request;
  }

  async function loadCurrentPage(targetPage: number, targetIndex = 0): Promise<void> {
    try {
      const nextItems = await getPage(targetPage);
      setItems(nextItems);
      setPage(targetPage);

      if (!nextItems.length) {
        setIndexInPage(0);
        setError('No articles found for this selection.');
      } else {
        setIndexInPage(Math.min(targetIndex, nextItems.length - 1));
        setError('');
      }
    } catch (requestError) {
      let message = 'Unable to load news right now.';

      if (requestError instanceof ApiError) {
        if (requestError.status === 429) {
          message = 'Daily request limit reached. Please try again tomorrow.';
        } else if (requestError.status === 401 || requestError.status === 403) {
          message = 'TheNewsApi authentication failed. Check server credentials.';
        } else {
          message = requestError.message || message;
        }
      }

      setItems([]);
      setIndexInPage(0);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setError('');
    setItems([]);
    setPage(1);
    setIndexInPage(0);
    void loadCurrentPage(1, 0);
  }, [queryKey]);

  useEffect(() => {
    if (viewMode !== 'live' || !items.length) {
      return;
    }

    if (indexInPage === 1) {
      const nextPage = page + 1;
      void getPage(nextPage).catch(() => undefined);
    }

    if (indexInPage === 0 && page > 1) {
      const previousPage = page - 1;
      void getPage(previousPage).catch(() => undefined);
    }
  }, [indexInPage, page, items.length, viewMode]);

  const activeArticle = items[indexInPage] || null;

  const currentAbsolute = (page - 1) * 3 + indexInPage + 1;
  const pagerStart = Math.max(1, currentAbsolute - 1);
  const pagerDots = [pagerStart, pagerStart + 1, pagerStart + 2];

  async function jumpToAbsolute(absolute: number): Promise<void> {
    if (absolute < 1) {
      return;
    }

    const targetPage = Math.ceil(absolute / 3);
    const targetIndex = (absolute - 1) % 3;

    if (targetPage === page && targetIndex < items.length) {
      setIndexInPage(targetIndex);
      return;
    }

    const cached = pageCacheRef.current.get(keyForPage(targetPage));
    if (cached) {
      setItems(cached);
      setPage(targetPage);
      setIndexInPage(Math.min(targetIndex, Math.max(0, cached.length - 1)));
      setError(cached.length ? '' : 'No articles found for this selection.');
      return;
    }

    setLoading(true);
    await loadCurrentPage(targetPage, targetIndex);
  }

  async function goNext(): Promise<void> {
    if (indexInPage < items.length - 1) {
      setIndexInPage((value) => value + 1);
      return;
    }

    const nextPage = page + 1;
    const cached = pageCacheRef.current.get(keyForPage(nextPage));

    if (cached) {
      setItems(cached);
      setPage(nextPage);
      setIndexInPage(0);
      setError(cached.length ? '' : 'No more articles available.');
      return;
    }

    setLoading(true);
    await loadCurrentPage(nextPage, 0);
  }

  async function goPrevious(): Promise<void> {
    if (indexInPage > 0) {
      setIndexInPage((value) => value - 1);
      return;
    }

    if (page <= 1) {
      return;
    }

    const previousPage = page - 1;
    const cached = pageCacheRef.current.get(keyForPage(previousPage));

    if (cached) {
      setItems(cached);
      setPage(previousPage);
      setIndexInPage(Math.max(0, cached.length - 1));
      setError(cached.length ? '' : 'No articles found for this selection.');
      return;
    }

    setLoading(true);
    await loadCurrentPage(previousPage, 2);
  }

  function toggleFavorite(article: NewsArticle): void {
    const key = makeFavoriteKey(article);

    setFavorites((previous) => {
      if (previous.some((item) => makeFavoriteKey(item) === key)) {
        return previous.filter((item) => makeFavoriteKey(item) !== key);
      }

      return [article, ...previous];
    });
  }

  const filtersPanel = (
    <div className="sidebar-panel">
      <label htmlFor="search-input">Search</label>
      <input
        id="search-input"
        type="search"
        placeholder="Search headlines"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />

      <p className="panel-title">Categories</p>
      <div className="category-grid" role="list" aria-label="News categories">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            role="listitem"
            className={category === selectedCategory ? 'category-btn active' : 'category-btn'}
            onClick={() => {
              setSelectedCategory(category);
              setSearchInput('');
              setViewMode('live');
            }}
          >
            {category}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="favorites-toggle"
        onClick={() => setViewMode((mode) => (mode === 'favorites' ? 'live' : 'favorites'))}
      >
        {viewMode === 'favorites' ? 'Back to Live News' : `Favorites (${favorites.length})`}
      </button>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>News Reader</h1>
        <button
          type="button"
          className="mobile-filter-toggle"
          onClick={() => setIsFiltersOpen((open) => !open)}
        >
          {isFiltersOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
      </header>

      <main className="layout">
        <aside className={isFiltersOpen ? 'sidebar open' : 'sidebar'}>{filtersPanel}</aside>

        <section className="content" aria-live="polite">
          {viewMode === 'favorites' ? (
            <div className="favorites-view">
              <h2>Saved Favorites</h2>
              {favorites.length ? (
                <div className="favorites-grid">
                  {favorites.map((article) => (
                    <article key={makeFavoriteKey(article)} className="favorite-item">
                      <img
                        src={article.image_url || '/placeholder.png'}
                        alt={article.title || 'Favorite article image'}
                        onError={(event) => {
                          (event.currentTarget as HTMLImageElement).src = '/placeholder.png';
                        }}
                      />
                      <div>
                        <h3>{article.title}</h3>
                        <p>{article.description || article.snippet || 'No summary available.'}</p>
                        <div className="favorite-actions">
                          <button type="button" onClick={() => toggleFavorite(article)}>
                            Remove Favorite
                          </button>
                          {article.url ? (
                            <a href={article.url} target="_blank" rel="noreferrer">
                              View Full Article
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-favorites">No favorites saved yet.</p>
              )}
            </div>
          ) : loading ? (
            <div className="loading-state" role="status" aria-label="Loading news">
              <div className="spinner" />
              <p>Loading latest stories...</p>
            </div>
          ) : error ? (
            <div className="error-state" role="alert">
              <p>{error}</p>
            </div>
          ) : (
            <>
              <HeadlinesList
                article={activeArticle}
                isFavorite={activeArticle ? favoritesMap.has(makeFavoriteKey(activeArticle)) : false}
                onToggleFavorite={toggleFavorite}
              />

              <nav className="pager" aria-label="Article pager">
                <button type="button" onClick={() => void jumpToAbsolute(1)}>
                  «
                </button>
                <button type="button" onClick={() => void goPrevious()}>
                  ‹
                </button>

                {pagerDots.map((dotNumber) => (
                  <button
                    key={dotNumber}
                    type="button"
                    className={dotNumber === currentAbsolute ? 'dot active' : 'dot'}
                    onClick={() => void jumpToAbsolute(dotNumber)}
                  >
                    {dotNumber}
                  </button>
                ))}

                <button type="button" onClick={() => void goNext()}>
                  ›
                </button>
              </nav>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
