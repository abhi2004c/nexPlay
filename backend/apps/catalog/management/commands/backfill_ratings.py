"""Fill in TMDB / RAWG ratings for titles that are already in the database (fast, no full re-import).

    python manage.py backfill_ratings

Movies: TMDB's popular lists carry vote_average for 20 movies per request, so most are covered by a
handful of requests; any left over are fetched one by one. Games: same idea with RAWG's list.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.catalog import importer
from apps.catalog.models import Title


class Command(BaseCommand):
    help = 'Store TMDB (movies) and RAWG (games) ratings on existing titles'

    def add_arguments(self, parser):
        parser.add_argument('--only', choices=['movies', 'games'], help='Only update one kind of title')

    def handle(self, *args, **o):
        try:
            if o['only'] != 'games':
                self.movies()
            if o['only'] != 'movies':
                self.games()
        except importer.ImportFailure as e:
            raise CommandError(str(e))
        have = Title.objects.exclude(external_rating=None).count()
        self.stdout.write(self.style.SUCCESS(f'{have} of {Title.objects.count()} titles now have a rating'))

    def set(self, media_type, ext_id, rating, votes):
        Title.objects.filter(media_type=media_type, external_id=str(ext_id)).update(
            external_rating=round(rating, 1) if votes else None, external_votes=votes or 0)

    def movies(self):
        todo = set(Title.objects.filter(media_type='movie').exclude(external_id='').values_list('external_id', flat=True))
        total, page = len(todo), 1
        while todo and page <= 30:  # popular list first: 20 movies per request
            for m in importer.tmdb('/movie/popular', page=page, language='en-US').get('results', []):
                if str(m['id']) in todo:
                    self.set('movie', m['id'], m.get('vote_average', 0), m.get('vote_count', 0))
                    todo.discard(str(m['id']))
            page += 1
        for ext_id in sorted(todo):  # anything not in the popular pages
            d = importer.tmdb(f'/movie/{ext_id}', language='en-US')
            self.set('movie', ext_id, d.get('vote_average', 0), d.get('vote_count', 0))
        self.stdout.write(f'Movies: {total} updated ({total - len(todo)} from list pages, {len(todo)} individually)')

    def games(self):
        todo = set(Title.objects.filter(media_type='game').exclude(external_id='').values_list('external_id', flat=True))
        total, page = len(todo), 1
        while todo and page <= 6:
            try:
                results = importer.rawg('/games', ordering='-added', page_size=40, page=page).get('results', [])
            except importer.ImportFailure:  # deep list pages sometimes fail: fetch the rest one by one
                break
            for g in results:
                if str(g['id']) in todo:
                    self.set('game', g['id'], (g.get('rating') or 0) * 2, g.get('ratings_count', 0))
                    todo.discard(str(g['id']))
            page += 1
        for ext_id in sorted(todo):
            d = importer.rawg(f'/games/{ext_id}')
            self.set('game', ext_id, (d.get('rating') or 0) * 2, d.get('ratings_count', 0))
        self.stdout.write(f'Games: {total} updated ({total - len(todo)} from list pages, {len(todo)} individually)')
