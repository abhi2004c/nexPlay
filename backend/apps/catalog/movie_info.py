"""Movie page extras, fetched live and cached: IMDb / TMDB rating and the trailer.

TMDB gives the trailer, its own rating and the IMDb id in one request. IMDb has no public API, so the
IMDb rating (plus Rotten Tomatoes / Metacritic) comes from OMDb, which needs a free OMDB_API_KEY.
Without that key the IMDb rating is left out and the page falls back to the TMDB rating.
"""

import os
import re
import urllib.parse

from django.core.cache import cache

from . import importer
from .net import get_json

OMDB = 'https://www.omdbapi.com/?'
TTL = 6 * 60 * 60


def _trailer(videos):
    """Best YouTube trailer: official trailers first, then any trailer, then a teaser."""
    yt = [v for v in videos if v.get('site') == 'YouTube' and v.get('key')]
    rank = lambda v: (  # noqa: E731
        0 if v.get('type') == 'Trailer' else 1 if v.get('type') == 'Teaser' else 2,
        0 if v.get('official') else 1,
    )
    best = sorted(yt, key=rank)[:1]
    return {'key': best[0]['key'], 'name': best[0].get('name', 'Trailer')} if best else None


def _clean(text, limit=700):
    text = re.sub(r'\r\n?', '\n', text or '')
    text = re.sub(r'[*_#>`]+', '', text)  # markdown markers that TMDB members sometimes include
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text if len(text) <= limit else text[:limit].rsplit(' ', 1)[0] + '…'


def _omdb(imdb_id):
    key = os.environ.get('OMDB_API_KEY')
    if not key or not imdb_id:
        return None
    try:
        d = get_json(OMDB + urllib.parse.urlencode({'i': imdb_id, 'apikey': key}))
    except Exception:
        return None
    if d.get('Response') != 'True':
        return None
    other = {r['Source']: r['Value'] for r in d.get('Ratings', [])}
    score = d.get('imdbRating')
    return {
        'score': float(score) if score and score != 'N/A' else None,
        'votes': d.get('imdbVotes') if d.get('imdbVotes') != 'N/A' else None,
        'rotten_tomatoes': other.get('Rotten Tomatoes'),
        'metacritic': (other.get('Metacritic') or '').replace('/100', '') or None,
    }


def build(title):
    d = importer.tmdb(f'/movie/{title.external_id}', append_to_response='videos,reviews', language='en-US')
    imdb_id = d.get('imdb_id') or ''
    imdb_url = f'https://www.imdb.com/title/{imdb_id}/' if imdb_id else None
    omdb = _omdb(imdb_id)
    reviews = [{
        'author': r.get('author') or 'TMDB member',
        'rating': (r.get('author_details') or {}).get('rating'),  # the member's own 0-10 score
        'text': _clean(r.get('content')),
        'date': (r.get('created_at') or '')[:10],
        'url': r.get('url'),
    } for r in (d.get('reviews') or {}).get('results', [])[:6] if (r.get('content') or '').strip()]
    return {
        'reviews': reviews,
        'trailer': _trailer((d.get('videos') or {}).get('results', [])),
        'tmdb': {
            'score': round(d['vote_average'], 1) if d.get('vote_count') else None,
            'votes': d.get('vote_count') or 0,
            'url': f'https://www.themoviedb.org/movie/{title.external_id}',
        },
        'imdb': {**omdb, 'url': imdb_url} if omdb else None,
        'imdb_url': imdb_url,
    }


def movie_info_payload(title):
    empty = {'trailer': None, 'tmdb': None, 'imdb': None, 'imdb_url': None, 'reviews': []}
    if title.media_type != 'movie' or not title.external_id:
        return {'available': False}
    key = f'movie_info:{title.external_id}'
    cached = cache.get(key)
    if cached is not None:
        return cached
    try:
        payload = {'available': True, 'error': None, **build(title)}
        cache.set(key, payload, TTL)
    except Exception as e:  # TMDB unreachable: the page still works without the extras
        payload = {'available': True, **empty, 'error': f'Movie details unavailable ({type(e).__name__})'}
        cache.set(key, payload, 120)
    return payload
