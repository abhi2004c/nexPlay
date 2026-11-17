"""Where-to-buy prices (CheapShark) and live player counts (Steam). Cached; never raises."""

import re
import urllib.parse
from datetime import datetime, timezone

from django.core.cache import cache

from .net import get_json

CHEAPSHARK = 'https://www.cheapshark.com/api/1.0'
STEAM_PLAYERS = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid='

PRICE_TTL = 60 * 60       # 1 hour
PLAYERS_TTL = 5 * 60      # 5 minutes
STORES_TTL = 24 * 60 * 60


def _norm(s):
    return re.sub(r'[^a-z0-9]+', '', (s or '').lower())


def _stores():
    data = cache.get('cs_stores')
    if data is None:
        data = {s['storeID']: s['storeName'] for s in get_json(f'{CHEAPSHARK}/stores')}
        cache.set('cs_stores', data, STORES_TTL)
    return data


def _resolve(title):
    """Find the CheapShark game id (and Steam app id) for a title, saving them once found."""
    if title.cheapshark_id:
        return True
    if cache.get(f'cs_miss_{title.pk}'):
        return False
    q = urllib.parse.urlencode({'title': title.name, 'limit': 10})
    want = _norm(title.name)
    for g in get_json(f'{CHEAPSHARK}/games?{q}'):
        if _norm(g.get('external')) == want:
            title.cheapshark_id = g['gameID']
            if g.get('steamAppID') and not title.steam_app_id:
                title.steam_app_id = g['steamAppID']
            title.save(update_fields=['cheapshark_id', 'steam_app_id'])
            return True
    cache.set(f'cs_miss_{title.pk}', True, 6 * 60 * 60)
    return False


def _iso(ts):
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).date().isoformat()
    except (TypeError, ValueError, OSError):
        return None


def get_prices(title):
    key = f'prices_{title.pk}'
    out = cache.get(key)
    if out is not None:
        return out
    out = {'found': False, 'currency': 'USD', 'deals': [], 'lowest_ever': None, 'current_lowest': None}
    if _resolve(title):
        data = get_json(f'{CHEAPSHARK}/games?id={title.cheapshark_id}')
        names = _stores()
        deals = [{
            'store': names.get(d['storeID'], f"Store {d['storeID']}"),
            'price': float(d['price']),
            'retail_price': float(d['retailPrice']),
            'savings': round(float(d['savings'])),
            'url': f"https://www.cheapshark.com/redirect?dealID={d['dealID']}",
        } for d in data.get('deals', [])]
        deals.sort(key=lambda d: d['price'])
        ever = data.get('cheapestPriceEver') or {}
        out.update(
            found=True,
            deals=deals,
            current_lowest=deals[0]['price'] if deals else None,
            lowest_ever={'price': float(ever['price']), 'date': _iso(ever.get('date'))} if ever.get('price') else None,
        )
    cache.set(key, out, PRICE_TTL)
    return out


def get_players(title):
    if not title.steam_app_id:
        return None
    key = f'players_{title.steam_app_id}'
    n = cache.get(key)
    if n is None:
        data = get_json(f'{STEAM_PLAYERS}{title.steam_app_id}')
        n = data.get('response', {}).get('player_count')
        if n is None:
            return None
        cache.set(key, n, PLAYERS_TTL)
    return n


def deals_payload(title):
    payload = {'available': True, 'error': None}
    try:
        payload.update(get_prices(title))
    except Exception as e:  # network / API failure: degrade gracefully
        payload.update(found=False, deals=[], lowest_ever=None, current_lowest=None,
                       currency='USD', error=f'Price lookup failed: {type(e).__name__}')
    try:
        payload['current_players'] = get_players(title)  # after prices: they may set steam_app_id
    except Exception:
        payload['current_players'] = None
    return payload
