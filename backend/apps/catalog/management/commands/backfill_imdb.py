"""Store the IMDb rating (from OMDb) on every movie so it can be shown on the cards.

    python manage.py backfill_imdb            # movies without an IMDb rating yet
    python manage.py backfill_imdb --all      # refresh every movie

Needs OMDB_API_KEY. The free OMDb plan allows 1,000 requests a day; each movie uses one.
"""

import time

from django.core.management.base import BaseCommand, CommandError

from apps.catalog import importer
from apps.catalog.models import Title


class Command(BaseCommand):
    help = 'Store IMDb ratings on existing movies'

    def add_arguments(self, parser):
        parser.add_argument('--all', action='store_true', help='Refresh movies that already have a rating too')

    def handle(self, *args, **o):
        import os
        if not os.environ.get('OMDB_API_KEY'):
            raise CommandError('Set OMDB_API_KEY in backend/.env first.')
        qs = Title.objects.filter(media_type='movie').exclude(external_id='')
        if not o['all']:
            qs = qs.filter(imdb_rating=None)
        done = missing = 0
        for t in qs:
            try:
                d = importer.tmdb(f'/movie/{t.external_id}', language='en-US')
                fields = importer.imdb_fields(d.get('imdb_id'))
            except Exception as e:  # one failure must not stop the rest; re-run to retry
                self.stdout.write(f'  {t.name}: {e}')
                missing += 1
                continue
            if fields:
                Title.objects.filter(pk=t.pk).update(**fields)
                done += 1
            else:
                missing += 1
            time.sleep(0.1)
        self.stdout.write(self.style.SUCCESS(f'{done} movies got an IMDb rating, {missing} have none (re-run to retry)'))
