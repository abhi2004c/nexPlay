"""Trailers and screenshots for a game: everything the Steam store page has. Cached; never raises."""

from django.core.cache import cache

from .net import get_json

APPDETAILS = 'https://store.steampowered.com/api/appdetails?l=english&appids='
TTL = 6 * 60 * 60


def _steam_media(app_id):
    """All trailers and all screenshots listed on the game's Steam store page."""
    key = f'steam_media_all:{app_id}'
    cached = cache.get(key)
    if cached is not None:
        return cached
    entry = get_json(f'{APPDETAILS}{app_id}').get(str(app_id), {})
    data = entry.get('data') or {}
    out = {
        'trailers': [{
            'name': m.get('name') or 'Trailer',
            'thumbnail': m.get('thumbnail', ''),
            'hls': m.get('hls_h264', ''),
            'mp4': (m.get('mp4') or {}).get('max') or (m.get('mp4') or {}).get('480', ''),
        } for m in data.get('movies', []) if m.get('hls_h264') or m.get('mp4')],
        'screenshots': [{
            'thumb': s.get('path_thumbnail') or s.get('path_full'),
            'full': s.get('path_full') or s.get('path_thumbnail'),
        } for s in data.get('screenshots', []) if s.get('path_full') or s.get('path_thumbnail')],
    }
    cache.set(key, out, TTL)
    return out


def media_payload(title):
    steam_url = f'https://store.steampowered.com/app/{title.steam_app_id}' if title.steam_app_id else ''
    # Fallback if Steam can't be reached: the (fewer) screenshots saved at import time from RAWG.
    payload = {
        'trailers': [],
        'screenshots': [{'thumb': u, 'full': u} for u in (title.screenshots or [])],
        'steam_url': steam_url,
        'source': 'saved',
    }
    if title.steam_app_id:
        try:
            steam = _steam_media(title.steam_app_id)
            payload['trailers'] = steam['trailers']
            if steam['screenshots']:
                payload['screenshots'] = steam['screenshots']
                payload['source'] = 'steam'
        except Exception:
            pass  # Steam unreachable: still return what we saved
    return payload
