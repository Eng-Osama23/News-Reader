# News Reader Proxy

Express proxy for TheNewsApi. It keeps `THENEWSAPI_TOKEN` on the server and exposes safe endpoints for the web app.

## Endpoints

- `GET /api/health`
- `GET /api/news/all?page=1&categories=tech`
- `GET /api/news/all?page=1&search=ai`

Rules enforced by the proxy:

- Calls only `https://api.thenewsapi.com/v1/news/all`
- Always sends `language=en` and `limit=3`
- Uses either `search` OR `categories` (never both)

## Environment

Copy `.env.example` to `.env` and set your token.

```bash
THENEWSAPI_TOKEN=your_real_token
PORT=5177
```
