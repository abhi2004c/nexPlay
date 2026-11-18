"""Give existing titles proper artwork (no full re-import).

    python manage.py backfill_art

Games: use Steam's portrait box-art as the poster and keep the old landscape image as the backdrop.
Movies: add TMDB's landscape backdrop (the popular-list pages carry it, so it takes few requests).
Safe to re-run.
"""

import time

from django.core.management.base import BaseCommand, CommandError

from apps.catalog import importer
from apps.catalog.models import Title


class Command(BaseCommand):
    help = 'Portrait box-art for games, landscape backdrops for movies'

    def add_arguments(self, parser):
        parser.add_argument('--only', choices=['movies', 'games'])

    def handle(self, *args, **o):
        try:
            if o['only'] != 'games':
                self.movies()
            if o['only'] != 'movies':
                self.games()
        except importer.ImportFailure as e:
            raise CommandError(str(e))

    def games(self):
        covered = landscape_only = 0
        for t in Title.objects.filter(media_type='game'):
            backdrop = t.backdrop_url
            poster = t.poster_url
            if not backdrop and poster and 'library_600x900' not in poster:
                backdrop = poster  # the old poster was RAWG's landscape image
            cover = importer.steam_cover(t.steam_app_id) if t.steam_app_id else ''
            if cover:
                poster = cover
                covered += 1
            else:
                landscape_only += 1
            if (poster, backdrop) != (t.poster_url, t.backdrop_url):
                Title.objects.filter(pk=t.pk).update(poster_url=poster, backdrop_url=backdrop)
            time.sleep(0.05)
        self.stdout.write(f'Games: {covered} now use portrait Steam box-art, {landscape_only} keep their landscape image')

    def movies(self):
        todo = set(Title.objects.filter(media_type='movie', backdrop_url='').exclude(external_id='')
                   .values_list('external_id', flat=True))
        total, page = len(todo), 1
        while todo and page <= 30:  # popular list pages carry backdrop_path for 20 movies each
            for m in importer.tmdb('/movie/popular', page=page, language='en-US').get('results', []):
                if str(m['id']) in todo and m.get('backdrop_path'):
                    self.set(m['id'], m['backdrop_path'])
                    todo.discard(str(m['id']))
            page += 1
        for ext_id in sorted(todo):
            d = importer.tmdb(f'/movie/{ext_id}', language='en-US')
            if d.get('backdrop_path'):
                self.set(ext_id, d['backdrop_path'])
        self.stdout.write(f'Movies: backdrops added for {total} movies')

    def set(self, ext_id, path):
        Title.objects.filter(media_type='movie', external_id=str(ext_id)).update(
            backdrop_url=f'{importer.TMDB_BACKDROP}{path}')
