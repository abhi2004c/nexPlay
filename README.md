# NexPlay

**Discover, rate, review and discuss movies and video games, all in one place.**

NexPlay is a full-stack web app. Browse a catalogue of popular movies and games, see scores from several sources side by side, write reviews, keep a personal list, add friends, and chat about what to watch or play next.

**Live site:** https://nex-play-dun.vercel.app
(The backend runs on a free host that sleeps when idle, so the first load can take up to a minute.)

> A college project built with Django, React and PostgreSQL.

---

## Features

**Discover**
- Home page with a featured banner, personalised picks for movies and games, and a grid of everything
- Separate **Movies** and **Games** pages, each with their own featured banner, recommendations, genre filters, and a poster or landscape card view
- Search from the top bar, scoped to the page you're on (Movies, Games, or both)
- A fresh shuffle on every visit, so the front page is never the same twice
- Add a title that isn't in the catalogue by searching TMDB / RAWG online

**Movie pages**
- Trailers, teasers and stills in a gallery
- IMDb and TMDB ratings, plus reviews written by TMDB members
- **Where to watch** by country (streaming, rent, buy), with a clear message when a film isn't available in your region

**Game pages**
- Every Steam trailer and screenshot in a gallery
- Steam review score with the review count, Metacritic score, live Steam player count
- **Where to buy** with the best current price, the all-time lowest price and its date, and a free-to-play notice

**Community**
- One review per person per title, with edit and delete, helpful / not helpful votes, spoiler warnings, and a report button
- Review analysis: sentiment breakdown and common keywords for each title
- Discussion threads on every title
- **Personal list** with four sections: Watching / playing now, Wishlist, Completed, Dropped
- **Profiles** with a picture, bio and review history; you choose whether friends can see your lists or only you
- **Friends** (send, accept, decline) and **chat** with near-instant delivery, where you can attach a movie or game to ask "have you seen this?" or to recommend it

**Accounts**
- Sign up with a username, email and password, or **Continue with Google**
- Forgot-password emails with one-use, expiring reset links
- Account settings: profile picture, username, password, delete account

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, hls.js (Steam trailers) |
| Backend | Python, Django 6, Django REST Framework, SimpleJWT, WhiteNoise, Gunicorn |
| Database | PostgreSQL on Supabase |
| Hosting | Vercel (frontend), Render (backend) |
| Automation | GitHub Actions (weekly catalogue top-up) |

**Data sources:** [TMDB](https://www.themoviedb.org) (movies, trailers, where to watch via JustWatch), [OMDb](https://www.omdbapi.com) (IMDb ratings), [RAWG](https://rawg.io) (games), [Steam](https://store.steampowered.com) (trailers, screenshots, reviews, players), [CheapShark](https://www.cheapshark.com) (game prices).

---

## How it fits together

```
Browser (React on Vercel)
        |  JSON over HTTPS, JWT login token
        v
Django REST API (Render)  --->  PostgreSQL (Supabase)
        |
        +--> TMDB, OMDb, RAWG, Steam, CheapShark   (cached on the server)
```

- The API caches slow third-party lookups, so pages stay fast.
- Chat uses long-polling on a single server process, so a message reaches the other person almost immediately without extra infrastructure.
- Profile pictures are resized in the browser to a small square JPEG and stored in the database.

```
backend/
  config/              settings and URL routes
  apps/accounts/       users, sign-up, Google login, password reset, avatars
  apps/catalog/        titles, genres, importers, recommendations, prices, media
  apps/reviews/        reviews, votes, reports, sentiment analysis
  apps/community/      list, threads, friends, chat, profiles
frontend/
  src/pages/           Home, Browse, TitlePage, Profile, Friends, Messages, Settings, ...
  src/components/      cards, galleries, reviews, search, ...
```

---

## Run it locally

You need Python 3.13, Node 20+, a PostgreSQL database (a free [Supabase](https://supabase.com) project works), and free API keys from [TMDB](https://www.themoviedb.org/settings/api), [RAWG](https://rawg.io/apidocs) and [OMDb](https://www.omdbapi.com/apikey.aspx).

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS / Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # then fill in the values (see the table below)
python manage.py migrate
python manage.py import_titles --movies 100 --games 100   # fill the catalogue
python manage.py createsuperuser                          # optional: admin login
python manage.py runserver
```

The API runs at http://localhost:8000/api/ and the admin at http://localhost:8000/admin/.

### 2. Frontend

```bash
cd frontend
npm install
echo VITE_API_URL=http://localhost:8000/api > .env
npm run dev
```

The app runs at http://localhost:5173.

### Environment variables

**Backend (`backend/.env`)**

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key; use a long random value in production |
| `DEBUG` | `True` locally, `False` in production |
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ALLOWED_ORIGINS` | Frontend address(es), comma-separated |
| `TMDB_API_KEY`, `RAWG_API_KEY`, `OMDB_API_KEY` | Catalogue and rating data |
| `FRONTEND_URL` | Used in password-reset links |
| `APPS_SCRIPT_URL`, `APPS_SCRIPT_SECRET` | Email relay for password reset (optional; see below) |
| `GOOGLE_CLIENT_ID` | Google sign-in (optional) |

**Frontend (`frontend/.env`)**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API address, ending in `/api` |
| `VITE_GOOGLE_CLIENT_ID` | Google sign-in (optional; the button is hidden without it) |

Never commit a real `.env` file. It is already in `.gitignore`.

### Password-reset emails

Free hosts block normal email ports, so the app sends mail through a small Google Apps Script that runs under your own Google account. Paste [`backend/email_relay.gs`](backend/email_relay.gs) into a new script at script.google.com, deploy it as a web app, and set `APPS_SCRIPT_URL` and `APPS_SCRIPT_SECRET`. Without these, reset links are printed in the server log, which is handy during development.

### Google sign-in

Create an OAuth **Web application** client in Google Cloud, add your site address under *Authorized JavaScript origins*, and put the Client ID in both `GOOGLE_CLIENT_ID` (backend) and `VITE_GOOGLE_CLIENT_ID` (frontend).

---

## Tests

```bash
cd backend
python manage.py test apps
```

The tests cover friends and list privacy, chat rules, the password-reset flow, account changes and deletion, review reports, and profile pictures. Run them against a throwaway database such as SQLite (`DATABASE_URL=sqlite:///test.sqlite3`, `DB_SSL_REQUIRE=False`), not your real one.

---

## Deployment

- **Backend (Render):** root directory `backend`, build command `./build.sh` (installs packages, collects static files, runs migrations), start command `gunicorn config.wsgi:application --workers 1 --threads 8 --timeout 60`. Keep it at one worker, because chat delivery shares memory between requests. See [`render.yaml`](render.yaml).
- **Frontend (Vercel):** root directory `frontend`, with `VITE_API_URL` set to your backend address plus `/api`.
- **Keep-alive:** point a free uptime monitor at `/api/health/` so the free server doesn't sleep.

### Weekly catalogue top-up

A GitHub Actions workflow ([`weekly-import.yml`](.github/workflows/weekly-import.yml)) runs every Monday and adds the next 50 most popular movies and 50 games that aren't in the database yet, then fills in IMDb ratings. It needs four repository secrets: `DATABASE_URL`, `TMDB_API_KEY`, `RAWG_API_KEY` and `OMDB_API_KEY`. You can also run it by hand from the Actions tab.

Useful management commands:

```bash
python manage.py import_titles --movies 50 --games 50 --new-only   # add new titles
python manage.py backfill_imdb                                      # IMDb ratings for movies
python manage.py backfill_ratings                                   # TMDB / Steam ratings
```

---

## API at a glance

| Area | Examples |
|---|---|
| Catalogue | `GET /api/titles/`, `/api/titles/<slug>/`, `/media/`, `/watch/`, `/deals/`, `/similar/`, `/api/genres/`, `/api/recommendations/` |
| Reviews | `/api/reviews/` (+ `vote`, `report`), `/api/titles/<slug>/analysis/` |
| Accounts | `/api/auth/register/`, `/token/`, `/google/`, `/me/`, `/password-reset/`, `/avatar/` |
| Social | `/api/users/<name>/`, `/api/friends/`, `/api/messages/`, `/api/watchlist/` |
| Health | `GET /api/health/` |

---

## Credits and data notice

- Movie data and images are from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
- Where-to-watch data is provided by JustWatch through TMDB.
- Game data is from RAWG; trailers, screenshots, reviews and player counts are from Steam; prices are from CheapShark; IMDb ratings are from OMDb.
- All trademarks, posters and game art belong to their respective owners.

---

Built by Abhinandan Choudhary as a college project.
