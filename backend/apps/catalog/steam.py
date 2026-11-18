"""Steam review totals for a game, from Steam's public review histogram. Cached; never raises.

Steam only serves individual review text to browsers, so we show the totals, the recent trend and a
link to read the reviews on Steam.
"""

from datetime import datetime, timezone

from django.core.cache import cache

from .net import get_json

HISTOGRAM = 'https://store.steampowered.com/appreviewhistogram/{id}?l=english'
TTL = 6 * 60 * 60


def steam_label(positive, total):
    """Steam's own review-summary scale (rules published by Valve)."""
    if total == 0:
        return ''
    pct = 100 * positive / total
    if total < 10:
        return ''  # Steam shows no summary below 10 reviews
    if pct >= 80:
        return ('Overwhelmingly Positive' if pct >= 95 and total >= 500
                else 'Very Positive' if total >= 50 else 'Positive')
    if pct >= 70:
        return 'Mostly Positive'
    if pct >= 40:
        return 'Mixed'
    if pct >= 20:
        return 'Mostly Negative'
    return ('Overwhelmingly Negative' if total >= 500
            else 'Very Negative' if total >= 50 else 'Negative')


def _pct(up, down):
    return round(100 * up / (up + down)) if (up + down) else None


def parse(results):
    rollups = results.get('rollups') or []
    up = sum(r.get('recommendations_up', 0) for r in rollups)
    down = sum(r.get('recommendations_down', 0) for r in rollups)
    total = up + down

    recent = (results.get('recent') or [])[-30:]
    r_up = sum(r.get('recommendations_up', 0) for r in recent)
    r_down = sum(r.get('recommendations_down', 0) for r in recent)

    monthly = [{
        'month': datetime.fromtimestamp(r['date'], tz=timezone.utc).strftime('%Y-%m'),
        'percent_positive': _pct(r.get('recommendations_up', 0), r.get('recommendations_down', 0)),
        'total': r.get('recommendations_up', 0) + r.get('recommendations_down', 0),
    } for r in rollups[-12:] if r.get('date')]

    return {
        'summary': {
            'label': steam_label(up, total),
            'total': total,
            'positive': up,
            'negative': down,
            'percent_positive': _pct(up, down),
        },
        'recent': {'days': 30, 'total': r_up + r_down, 'percent_positive': _pct(r_up, r_down)},
        'monthly': monthly,
    }


def steam_rating(app_id):
    """(percent_positive, total_reviews) from Steam's review histogram, or None if there are no reviews."""
    data = get_json(HISTOGRAM.format(id=app_id))
    if not data.get('success'):
        return None
    s = parse(data.get('results') or {})['summary']
    return (s['percent_positive'], s['total']) if s['total'] else None


def steam_reviews_payload(title):
    if not title.steam_app_id:
        return {'available': False}
    key = f'steam_hist_{title.steam_app_id}'
    cached = cache.get(key)
    if cached is not None:
        return cached
    base = {'available': True, 'steam_url': f'https://store.steampowered.com/app/{title.steam_app_id}#app_reviews_hash'}
    try:
        data = get_json(HISTOGRAM.format(id=title.steam_app_id))
        if not data.get('success'):
            raise ValueError('no data')
        payload = {**base, **parse(data.get('results') or {}), 'error': None}
        cache.set(key, payload, TTL)
        return payload
    except Exception as e:  # Steam down / blocked: degrade gracefully (short cache)
        payload = {**base, 'summary': None, 'recent': None, 'monthly': [],
                   'error': f'Steam reviews unavailable ({type(e).__name__})'}
        cache.set(key, payload, 120)
        return payload
