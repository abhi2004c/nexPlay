"""Trailers (from Steam's store data) and screenshots. Cached; never raises."""

from django.core.cache import cache

from .net import get_json

APPDETAILS = 'https://store.steampowered.com/api/appdetails?l=english&appids='
TTL = 6 * 60 * 60


def _steam_media(app_id):
    key = f'steam_media_{app_id}'
    cached = cache.get(key)
    if cached is not None:
        return cached
    out = {'trailers': [], 'screenshots': []}
    entry = get_json(f'{APPDETAILS}{app_id}').get(str(app_id), {})
    data = entry.get('data') or {}
    for m in data.get('movies', [])[:3]:
        out['trailers'].append({
            'name': m.get('name', 'Trailer'),
            'thumbnail': m.get('thumbnail', ''),
            'hls': m.get('hls_h264', ''),
            'mp4': (m.get('mp4') or {}).get('max') or (m.get('mp4') or {}).get('480', ''),
        })
    out['screenshots'] = [s['path_full'] for s in data.get('screenshots', []) if s.get('path_full')][:10]
    cache.set(key, out, TTL)
    return out


def media_payload(title):
    steam_url = f'https://store.steampowered.com/app/{title.steam_app_id}' if title.steam_app_id else ''
    payload = {'trailers': [], 'screenshots': list(title.screenshots or []), 'steam_url': steam_url}
    if title.steam_app_id:
        try:
            steam = _steam_media(title.steam_app_id)
            payload['trailers'] = steam['trailers']
            if not payload['screenshots']:
                payload['screenshots'] = steam['screenshots']
        except Exception:
            pass  # Steam unreachable: still return the stored screenshots
    return payload
