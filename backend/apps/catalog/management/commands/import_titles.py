"""Import real movies (TMDB) and games (RAWG).

Usage:
    python manage.py import_titles --movies 40 --games 40
    python manage.py import_titles --movies 40 --games 0 --clear-seed

Keys come from env: TMDB_API_KEY (v3 key or v4 read token) and RAWG_API_KEY.
Safe to re-run: titles are matched on (media_type, external_id) and updated.
"""

import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.catalog.models import Genre, Title
from apps.catalog.net import get_json

TMDB_HOSTS = ['api.themoviedb.org', 'api.tmdb.org']
TMDB_IMG = 'https://image.tmdb.org/t/p/w500'
RAWG = 'https://api.rawg.io/api'


def parse_date(s):
    try:
        return date.fromisoformat(s) if s else None
    except ValueError:
        return None


class Command(BaseCommand):
    help = 'Import popular movies from TMDB and games from RAWG'

    def add_arguments(self, parser):
        parser.add_argument('--movies', type=int, default=40)
        parser.add_argument('--games', type=int, default=40)
        parser.add_argument('--clear-seed', action='store_true',
                            help='Delete the sample titles from `seed` (those without an external id)')

    def handle(self, *args, **o):
        if o['movies']:
            self.import_movies(o['movies'])
        if o['games']:
            self.import_games(o['games'])
        if o['clear_seed']:
            n, _ = Title.objects.filter(external_id='').delete()
            self.stdout.write(f'Removed {n} sample records')
        self.stdout.write(self.style.SUCCESS(f'{Title.objects.count()} titles in database'))

    # ---- TMDB -----------------------------------------------------------
    def tmdb(self, path, **params):
        key = os.environ.get('TMDB_API_KEY')
        if not key:
            raise CommandError('Set TMDB_API_KEY in backend/.env')
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
            except urllib.error.HTTPError:
                raise
            except urllib.error.URLError as e:
                last = e
        raise CommandError(
            f'Cannot reach TMDB from this network ({last.reason}). '
            'Try a VPN or a different network (or set DNS to 1.1.1.1), then re-run.')

    def import_movies(self, count):
        ids, page = [], 1
        while len(ids) < count:
            results = self.tmdb('/movie/popular', page=page, language='en-US')['results']
            if not results:
                break
            ids += [m['id'] for m in results]
            page += 1
        for tmdb_id in ids[:count]:
            d = self.tmdb(f'/movie/{tmdb_id}', append_to_response='credits', language='en-US')
            director = next((c['name'] for c in d.get('credits', {}).get('crew', [])
                             if c.get('job') == 'Director'), '')
            self.save(d['title'], 'movie', str(tmdb_id), dict(
                description=d.get('overview') or '',
                release_date=parse_date(d.get('release_date')),
                poster_url=f"{TMDB_IMG}{d['poster_path']}" if d.get('poster_path') else '',
                creator=director,
                runtime_minutes=d.get('runtime') or None,
            ), [g['name'] for g in d.get('genres', [])])
        self.stdout.write(f'Imported {min(count, len(ids))} movies')

    # ---- RAWG -----------------------------------------------------------
    def rawg(self, path, **params):
        key = os.environ.get('RAWG_API_KEY')
        if not key:
            raise CommandError('Set RAWG_API_KEY in backend/.env')
        params['key'] = key
        return get_json(f'{RAWG}{path}?{urllib.parse.urlencode(params)}')

    def import_games(self, count):
        ids, page = [], 1
        while len(ids) < count:
            results = self.rawg('/games', ordering='-added', page_size=40, page=page)['results']
            if not results:
                break
            ids += [g['id'] for g in results]
            page += 1
        for rawg_id in ids[:count]:
            d = self.rawg(f'/games/{rawg_id}')
            is_free = any(t.get('slug') == 'free-to-play' for t in d.get('tags', []))
            links, steam_id = self.free_game_links(rawg_id)  # store links + Steam app id for every game
            shots = [x['image'] for x in self.rawg(f'/games/{rawg_id}/screenshots').get('results', [])][:10]
            self.save(d['name'], 'game', str(rawg_id), dict(
                is_free=is_free,
                store_links=links,
                screenshots=shots,
                metacritic=d.get('metacritic'),
                metacritic_url=d.get('metacritic_url') or '',
                **({'steam_app_id': steam_id} if steam_id else {}),
                description=(d.get('description_raw') or '')[:2000],
                release_date=parse_date(d.get('released')),
                poster_url=d.get('background_image') or '',
                creator=', '.join(x['name'] for x in d.get('developers', [])[:2]),
                platforms=', '.join(p['platform']['name'] for p in d.get('platforms', []) or [])[:200],
            ), [g['name'] for g in d.get('genres', [])])
        self.stdout.write(f'Imported {min(count, len(ids))} games')

    RAWG_STORES = {1: 'Steam', 2: 'Xbox Store', 3: 'PlayStation Store', 4: 'App Store', 5: 'GOG',
                   6: 'Nintendo eShop', 8: 'Google Play', 9: 'itch.io', 11: 'Epic Games Store'}

    def free_game_links(self, rawg_id):
        """Where a free-to-play game can be downloaded, plus its Steam app id if it is on Steam."""
        links, steam_id = [], ''
        for r in self.rawg(f'/games/{rawg_id}/stores').get('results', []):
            url = (r.get('url') or '').replace('http://', 'https://')
            if not url:
                continue
            links.append({'name': self.RAWG_STORES.get(r.get('store_id'), 'Store'), 'url': url})
            m = re.search(r'store\.steampowered\.com/app/(\d+)', url)
            if m:
                steam_id = m.group(1)
        return links, steam_id

    # ---------------------------------------------------------------------
    def save(self, name, media_type, external_id, fields, genre_names):
        title, _ = Title.objects.update_or_create(
            media_type=media_type, external_id=external_id,
            defaults={'name': name[:200], **fields})
        title.genres.set([Genre.objects.get_or_create(name=g)[0] for g in genre_names])
        year = fields['release_date'].year if fields.get('release_date') else '?'
        self.stdout.write(f'  [{media_type}] {name} ({year})')
