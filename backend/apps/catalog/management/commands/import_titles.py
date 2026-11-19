"""Bulk-import popular movies (TMDB) and games (RAWG).

Usage:
    python manage.py import_titles --movies 40 --games 40
    python manage.py import_titles --movies 50 --games 50 --new-only   # the weekly top-up
    python manage.py import_titles --movies 40 --games 0 --clear-seed

Keys come from env: TMDB_API_KEY (v3 key or v4 read token) and RAWG_API_KEY.
Safe to re-run: titles are matched on (media_type, external_id) and updated.
Individual titles can also be added on demand through the search-and-add API.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.catalog import importer
from apps.catalog.models import Title


class Command(BaseCommand):
    help = 'Import popular movies from TMDB and games from RAWG'

    def add_arguments(self, parser):
        parser.add_argument('--movies', type=int, default=40)
        parser.add_argument('--games', type=int, default=40)
        parser.add_argument('--new-only', action='store_true',
                            help='Skip titles already in the database and take the next most popular ones instead')
        parser.add_argument('--clear-seed', action='store_true',
                            help='Delete the sample titles from `seed` (those without an external id)')

    def handle(self, *args, **o):
        try:
            self.run_import('movie', o['movies'], importer.popular_movie_ids, o['new_only'])
            self.run_import('game', o['games'], importer.popular_game_ids, o['new_only'])
        except importer.ImportFailure as e:
            raise CommandError(str(e))
        if o['clear_seed']:
            n, _ = Title.objects.filter(external_id='').delete()
            self.stdout.write(f'Removed {n} sample records')
        self.stdout.write(self.style.SUCCESS(f'{Title.objects.count()} titles in database'))

    def run_import(self, media_type, count, list_ids, new_only=False):
        if not count:
            return
        skip = Title.objects.filter(media_type=media_type).exclude(external_id='').values_list('external_id', flat=True) if new_only else ()
        ids = list_ids(count, skip=list(skip))
        for external_id in ids:
            try:
                t = importer.import_one(media_type, external_id)
            except importer.ImportFailure as e:  # one bad title must not stop the weekly batch
                self.stdout.write(f'  [{media_type}] {external_id}: skipped ({e})')
                continue
            year = t.release_date.year if t.release_date else '?'
            self.stdout.write(f'  [{media_type}] {t.name} ({year})')
        self.stdout.write(f'Imported {len(ids)} {media_type}s')
