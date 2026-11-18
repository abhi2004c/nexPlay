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
def popular_movie_ids(count):
    ids, page = [], 1
    while len(ids) < count:
        results = tmdb('/movie/popular', page=page, language='en-US')['results']
        if not results:
            break
        ids += [m['id'] for m in results]
        page += 1
    return ids[:count]


def popular_game_ids(count):
    ids, page = [], 1
    while len(ids) < count:
        results = rawg('/games', ordering='-added', page_size=40, page=page)['results']
        if not results:
            break
        ids += [g['id'] for g in results]
        page += 1
    return ids[:count]


# ---- search (on demand) -------------------------------------------------------------
def search(query, media_type, limit=8):
    """Return lightweight matches (not saved): [{media_type, external_id, name, year, poster}]."""
    out = []
    if media_type == 'movie':
        for m in tmdb('/search/movie', query=query, language='en-US', include_adult='false').get('results', [])[:limit]:
            out.append({
                'media_type': 'movie', 'external_id': str(m['id']), 'name': m.get('title', ''),
                'year': (m.get('release_date') or '')[:4],
                'poster': f"{TMDB_IMG_SMALL}{m['poster_path']}" if m.get('poster_path') else '',
            })
    else:
        for g in rawg('/games', search=query, page_size=limit, search_precise='true').get('results', []):
            out.append({
                'media_type': 'game', 'external_id': str(g['id']), 'name': g.get('name', ''),
                'year': (g.get('released') or '')[:4], 'poster': g.get('background_image') or '',
            })
    return out


# ---- fetch + save one title ------------------------------------------------------------
def _game_links(rawg_id):
    """Where a game can be bought/downloaded, plus its Steam app id if it is on Steam."""
    links, steam_id = [], ''
    for r in rawg(f'/games/{rawg_id}/stores').get('results', []):
        url = (r.get('url') or '').replace('http://', 'https://')
        if not url:
            continue
        links.append({'name': RAWG_STORES.get(r.get('store_id'), 'Store'), 'url': url})
        m = re.search(r'store\.steampowered\.com/app/(\d+)', url)
        if m:
            steam_id = m.group(1)
    return links, steam_id


def _save(name, media_type, external_id, fields, genre_names):
    title, _ = Title.objects.update_or_create(
        media_type=media_type, external_id=external_id,
        defaults={'name': name[:200], **fields})
    title.genres.set([Genre.objects.get_or_create(name=g)[0] for g in genre_names])
    return title


def import_movie(tmdb_id):
    d = tmdb(f'/movie/{tmdb_id}', append_to_response='credits', language='en-US')
    director = next((c['name'] for c in d.get('credits', {}).get('crew', []) if c.get('job') == 'Director'), '')
    return _save(d['title'], 'movie', str(tmdb_id), dict(
        description=d.get('overview') or '',
        release_date=parse_date(d.get('release_date')),
        poster_url=f"{TMDB_IMG}{d['poster_path']}" if d.get('poster_path') else '',
        creator=director,
        runtime_minutes=d.get('runtime') or None,
        external_rating=round(d['vote_average'], 1) if d.get('vote_count') else None,
        external_votes=d.get('vote_count') or 0,
    ), [g['name'] for g in d.get('genres', [])])


def import_game(rawg_id):
    d = rawg(f'/games/{rawg_id}')
    is_free = any(t.get('slug') == 'free-to-play' for t in d.get('tags', []))
    links, steam_id = _game_links(rawg_id)
    shots = [x['image'] for x in rawg(f'/games/{rawg_id}/screenshots').get('results', [])][:10]
    return _save(d['name'], 'game', str(rawg_id), dict(
        is_free=is_free,
        store_links=links,
        screenshots=shots,
        metacritic=d.get('metacritic'),
        metacritic_url=d.get('metacritic_url') or '',
        external_rating=round(d['rating'] * 2, 1) if d.get('ratings_count') else None,  # RAWG is out of 5
        external_votes=d.get('ratings_count') or 0,
        **({'steam_app_id': steam_id} if steam_id else {}),
        description=(d.get('description_raw') or '')[:2000],
        release_date=parse_date(d.get('released')),
        poster_url=d.get('background_image') or '',
        creator=', '.join(x['name'] for x in d.get('developers', [])[:2]),
        platforms=', '.join(p['platform']['name'] for p in d.get('platforms', []) or [])[:200],
    ), [g['name'] for g in d.get('genres', [])])


def import_one(media_type, external_id):
    return import_movie(external_id) if media_type == 'movie' else import_game(external_id)
