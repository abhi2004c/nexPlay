"""Fetch movies (TMDB) and games (RAWG) and save them as Titles.

Used by the `import_titles` command (bulk) and by the on-demand search-and-add API.
Keys come from env: TMDB_API_KEY (v3 key or v4 read token) and RAWG_API_KEY.
"""

import os
import re
import time
import urllib.error
import urllib.parse
from datetime import date

from .models import Genre, Title
from .net import get_json
from .steam import steam_rating

TMDB_HOSTS = ['api.themoviedb.org', 'api.tmdb.org']
TMDB_IMG = 'https://image.tmdb.org/t/p/w500'
TMDB_IMG_SMALL = 'https://image.tmdb.org/t/p/w185'
RAWG = 'https://api.rawg.io/api'
RAWG_STORES = {1: 'Steam', 2: 'Xbox Store', 3: 'PlayStation Store', 4: 'App Store', 5: 'GOG',
               6: 'Nintendo eShop', 8: 'Google Play', 9: 'itch.io', 11: 'Epic Games Store'}


class ImportFailure(Exception):
    """Something went wrong talking to TMDB / RAWG (message is safe to show to users)."""


def parse_date(s):
    try:
        return date.fromisoformat(s) if s else None
    except ValueError:
        return None


# ---- API clients -------------------------------------------------------------
def tmdb(path, **params):
    key = os.environ.get('TMDB_API_KEY')
    if not key:
        raise ImportFailure('Movie search is not configured (TMDB_API_KEY is missing).')
    headers = {}
    if key.startswith('eyJ'):  # v4 read access token
        headers['Authorization'] = f'Bearer {key}'
    else:
        params['api_key'] = key
    query = urllib.parse.urlencode(params)
    last = None
    for host in TMDB_HOSTS:  # the main host is blocked on some networks
        try:
            return get_json(f'https://{host}/3{path}?{query}', headers)
        except urllib.error.HTTPError as e:
            raise ImportFailure(f'TMDB returned an error ({e.code}).') from e
        except urllib.error.URLError as e:
            last = e
    raise ImportFailure(f'Cannot reach TMDB ({getattr(last, "reason", last)}).')


def rawg(path, **params):
    key = os.environ.get('RAWG_API_KEY')
    if not key:
        raise ImportFailure('Game search is not configured (RAWG_API_KEY is missing).')
    params['key'] = key
    url = f'{RAWG}{path}?{urllib.parse.urlencode(params)}'
    for attempt in range(3):  # RAWG occasionally stalls: retry before giving up
        try:
            return get_json(url)
        except urllib.error.HTTPError as e:
            if e.code < 500 or attempt == 2:  # 5xx is RAWG's own hiccup: worth another try
                raise ImportFailure(f'RAWG returned an error ({e.code}).') from e
            time.sleep(2 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if attempt == 2:
                raise ImportFailure(f'Cannot reach RAWG ({getattr(e, "reason", e)}).') from e
            time.sleep(2 * (attempt + 1))


# ---- lists (bulk) --------------------------------------------------------------
MAX_LIST_PAGES = 60  # how deep into the popularity lists we are willing to look for new titles


def _collect(count, skip, fetch_page, id_of):
    """The first `count` ids from a popularity list that are not in `skip` (ids already imported)."""
    ids, seen, page = [], set(skip), 1
    while len(ids) < count and page <= MAX_LIST_PAGES:
        results = fetch_page(page)
        if not results:
            break
        for r in results:
            i = str(id_of(r))
            if i not in seen:
                seen.add(i)
                ids.append(i)
        page += 1
    return ids[:count]


def popular_movie_ids(count, skip=()):
    return _collect(count, skip, lambda p: tmdb('/movie/popular', page=p, language='en-US')['results'], lambda m: m['id'])


def popular_game_ids(count, skip=()):
    return _collect(count, skip, lambda p: rawg('/games', ordering='-added', page_size=40, page=p)['results'], lambda g: g['id'])



def steam_cover(app_id):
    """Portrait box-art for a Steam game, or '' if Steam has none (a few older games)."""
    url = STEAM_COVER.format(app_id)
    try:
        req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'NexPlay/1.0'})
        with urllib.request.urlopen(req, timeout=15) as r:
            return url if r.status == 200 else ''
    except Exception:
        return ''


def _save(name, media_type, external_id, fields, genre_names):
    title, _ = Title.objects.update_or_create(
        media_type=media_type, external_id=external_id,
        defaults={'name': name[:200], **fields})
    title.genres.set([Genre.objects.get_or_create(name=g)[0] for g in genre_names])
    return title


def imdb_fields(imdb_id):
    """IMDb rating and vote count from OMDb (empty when there is no key, id or rating)."""
    from .movie_info import _omdb  # imported here: movie_info imports this module
    o = _omdb(imdb_id) if imdb_id else None
    if not o or o['score'] is None:
        return {}
    votes = int((o['votes'] or '0').replace(',', '') or 0)
    return {'imdb_rating': o['score'], 'imdb_votes': votes}


def import_movie(tmdb_id):
    d = tmdb(f'/movie/{tmdb_id}', append_to_response='credits', language='en-US')
    director = next((c['name'] for c in d.get('credits', {}).get('crew', []) if c.get('job') == 'Director'), '')
    return _save(d['title'], 'movie', str(tmdb_id), dict(
        description=d.get('overview') or '',
        release_date=parse_date(d.get('release_date')),
        poster_url=f"{TMDB_IMG}{d['poster_path']}" if d.get('poster_path') else '',
        backdrop_url=f"{TMDB_BACKDROP}{d['backdrop_path']}" if d.get('backdrop_path') else '',
        creator=director,
        runtime_minutes=d.get('runtime') or None,
        external_rating=round(d['vote_average'], 1) if d.get('vote_count') else None,
        external_votes=d.get('vote_count') or 0,
        **imdb_fields(d.get('imdb_id')),
    ), [g['name'] for g in d.get('genres', [])])


def import_game(rawg_id):
    d = rawg(f'/games/{rawg_id}')
    is_free = any(t.get('slug') == 'free-to-play' for t in d.get('tags', []))
    links, steam_id = _game_links(rawg_id)
    steam = None
    if steam_id:
        try:
            steam = steam_rating(steam_id)
        except Exception:  # Steam hiccup: the rating can be filled in later by backfill_ratings
            pass
    shots = [x['image'] for x in rawg(f'/games/{rawg_id}/screenshots').get('results', [])][:10]
    return _save(d['name'], 'game', str(rawg_id), dict(
        is_free=is_free,
        store_links=links,
        screenshots=shots,
        metacritic=d.get('metacritic'),
        metacritic_url=d.get('metacritic_url') or '',
        # games are rated by Steam players: percent positive on a 0-10 scale (84% -> 8.4)
        external_rating=round(steam[0] / 10, 1) if steam else None,
        external_votes=steam[1] if steam else 0,
        **({'steam_app_id': steam_id} if steam_id else {}),
        description=(d.get('description_raw') or '')[:2000],
        release_date=parse_date(d.get('released')),
        # portrait box-art from Steam when it exists; RAWG's landscape image is kept as the backdrop
        poster_url=(steam_cover(steam_id) if steam_id else '') or d.get('background_image') or '',
        backdrop_url=d.get('background_image') or '',
        creator=', '.join(x['name'] for x in d.get('developers', [])[:2]),
        platforms=', '.join(p['platform']['name'] for p in d.get('platforms', []) or [])[:200],
    ), [g['name'] for g in d.get('genres', [])])


def import_one(media_type, external_id):
    return import_movie(external_id) if media_type == 'movie' else import_game(external_id)
