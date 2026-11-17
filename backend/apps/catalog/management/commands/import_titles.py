"""Import real movies (TMDB) and games (RAWG).

Usage:
    python manage.py import_titles --movies 40 --games 40
    python manage.py import_titles --movies 40 --games 0 --clear-seed

Keys come from env: TMDB_API_KEY (v3 key or v4 read token) and RAWG_API_KEY.
Safe to re-run: titles are matched on (media_type, external_id) and updated.
"""

import json
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

from django.core.management.base import BaseCommand, CommandError

from apps.catalog.models import Genre, Title

TMDB_HOSTS = ['api.themoviedb.org', 'api.tmdb.org']
TMDB_IMG = 'https://image.tmdb.org/t/p/w500'
RAWG = 'https://api.rawg.io/api'


def _open(req, context=None):
    with urllib.request.urlopen(req, timeout=30, context=context) as resp:
        return json.load(resp)


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'NexPlay/1.0', **(headers or {})})
    try:
        return _open(req)
    except urllib.error.URLError as e:
        if not isinstance(e.reason, ssl.SSLError):
            raise
        # Some networks drop Python 3.14 / OpenSSL 3.5's TLS 1.3 handshake: retry on TLS 1.2.
        ctx = ssl.create_default_context()
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
        return _open(req, ctx)


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
            self.save(d['name'], 'game', str(rawg_id), dict(
                description=(d.get('description_raw') or '')[:2000],
                release_date=parse_date(d.get('released')),
                poster_url=d.get('background_image') or '',
                creator=', '.join(x['name'] for x in d.get('developers', [])[:2]),
                platforms=', '.join(p['platform']['name'] for p in d.get('platforms', []) or [])[:200],
            ), [g['name'] for g in d.get('genres', [])])
        self.stdout.write(f'Imported {min(count, len(ids))} games')

    # ---------------------------------------------------------------------
    def save(self, name, media_type, external_id, fields, genre_names):
        title, _ = Title.objects.update_or_create(
            media_type=media_type, external_id=external_id,
            defaults={'name': name[:200], **fields})
        title.genres.set([Genre.objects.get_or_create(name=g)[0] for g in genre_names])
