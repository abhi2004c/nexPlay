"""Steam user reviews for a game (public store endpoint). Cached; never raises."""

import re

from django.core.cache import cache

from .net import get_json

URL = (
    'https://store.steampowered.com/appreviews/{id}'
    '?json=1&language=english&filter=all&review_type=all&purchase_type=all&num_per_page=5'
)
TTL = 60 * 60
BBCODE = re.compile(r'\[/?[a-zA-Z0-9*]+(?:=[^\]]*)?\]')  # [b], [h1], [url=...], [/list] ...


def _clean(text, limit=500):
    text = BBCODE.sub('', text or '')
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text if len(text) <= limit else text[:limit].rsplit(' ', 1)[0] + '…'


def parse(data):
    summary = data.get('query_summary') or {}
    total = summary.get('total_reviews') or 0
    pos = summary.get('total_positive') or 0
    return {
        'summary': {
            'label': summary.get('review_score_desc') or '',
            'total': total,
            'positive': pos,
            'negative': summary.get('total_negative') or 0,
            'percent_positive': round(100 * pos / total) if total else None,
        },
        'reviews': [{
            'text': _clean(r.get('review')),
            'recommended': bool(r.get('voted_up')),
            'hours': round((r.get('author') or {}).get('playtime_forever', 0) / 60, 1),
            'helpful': r.get('votes_up', 0),
            'posted': r.get('timestamp_created'),
        } for r in data.get('reviews', []) if (r.get('review') or '').strip()],
    }


def steam_reviews_payload(title):
    if not title.steam_app_id:
        return {'available': False}
    key = f'steam_reviews_{title.steam_app_id}'
    cached = cache.get(key)
    if cached is not None:
        return cached
    base = {'available': True, 'steam_url': f'https://store.steampowered.com/app/{title.steam_app_id}#app_reviews_hash'}
    try:
        data = get_json(URL.format(id=title.steam_app_id))
        if not data.get('success'):
            raise ValueError('no data')
        payload = {**base, **parse(data), 'error': None}
        cache.set(key, payload, TTL)
        return payload
    except Exception as e:  # Steam down / blocked: degrade gracefully (short cache)
        payload = {**base, 'summary': None, 'reviews': [], 'error': f'Steam reviews unavailable ({type(e).__name__})'}
        cache.set(key, payload, 120)
        return payload
