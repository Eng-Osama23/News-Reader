import type { NewsArticle } from '../lib/newsapi';

interface HeadlinesListProps {
  article: NewsArticle | null;
  isFavorite: boolean;
  onToggleFavorite: (article: NewsArticle) => void;
}

export function HeadlinesList({ article, isFavorite, onToggleFavorite }: HeadlinesListProps) {
  if (!article) {
    return (
      <section className="featured-card empty-state" aria-live="polite">
        <p>No article available for this page.</p>
      </section>
    );
  }

  const imageUrl = article.image_url || '/placeholder.png';
  const summary = article.description || article.snippet || 'No summary available.';

  return (
    <article className="featured-card" role="article">
      <img
        src={imageUrl}
        alt={article.title || 'News article image'}
        className="featured-image"
        onError={(event) => {
          (event.currentTarget as HTMLImageElement).src = '/placeholder.png';
        }}
      />

      <div className="overlay-panel">
        <p className="kicker">{article.source || 'Unknown Source'}</p>
        <h1>{article.title}</h1>
        <p>{summary}</p>

        <div className="card-actions">
          <button type="button" onClick={() => onToggleFavorite(article)}>
            {isFavorite ? 'Remove Favorite' : 'Save to Favorites'}
          </button>

          {article.url ? (
            <a href={article.url} target="_blank" rel="noreferrer">
              View Full Article
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
