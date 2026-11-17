from datetime import date

from django.core.management.base import BaseCommand

from apps.catalog.models import Genre, Title

MOVIES = [
    ('Inception', 2010, 'Christopher Nolan', 148, ['Sci-Fi', 'Thriller'], 'A thief who steals secrets through dreams is offered a chance to erase his past.'),
    ('The Dark Knight', 2008, 'Christopher Nolan', 152, ['Action', 'Crime'], 'Batman faces the Joker, an anarchist who plunges Gotham into chaos.'),
    ('Spirited Away', 2001, 'Hayao Miyazaki', 125, ['Fantasy', 'Animation'], 'A girl wanders into a world of spirits and must save her parents.'),
    ('Parasite', 2019, 'Bong Joon-ho', 132, ['Thriller', 'Drama'], 'A poor family schemes its way into the lives of a wealthy household.'),
    ('Interstellar', 2014, 'Christopher Nolan', 169, ['Sci-Fi', 'Drama'], 'Explorers travel through a wormhole to find humanity a new home.'),
    ('Mad Max: Fury Road', 2015, 'George Miller', 120, ['Action', 'Sci-Fi'], 'In a desert wasteland, a drifter helps rebels flee a tyrant.'),
]
GAMES = [
    ('The Legend of Zelda: Breath of the Wild', 2017, 'Nintendo', 'Switch', ['Adventure', 'Fantasy'], 'Explore a vast open Hyrule and defeat Calamity Ganon.'),
    ('Elden Ring', 2022, 'FromSoftware', 'PC, PS5, Xbox', ['RPG', 'Fantasy'], 'A sprawling open-world action RPG co-created with George R. R. Martin.'),
    ('Hades', 2020, 'Supergiant Games', 'PC, Switch, PS5', ['Roguelike', 'Action'], 'Battle out of the underworld in this fast-paced dungeon crawler.'),
    ('Hollow Knight', 2017, 'Team Cherry', 'PC, Switch, PS4', ['Metroidvania', 'Adventure'], 'Descend into a ruined insect kingdom full of secrets.'),
    ('Portal 2', 2011, 'Valve', 'PC, PS3, Xbox 360', ['Puzzle', 'Sci-Fi'], 'Solve physics puzzles with the portal gun alongside GLaDOS.'),
    ('Stardew Valley', 2016, 'ConcernedApe', 'PC, Switch, Mobile', ['Simulation', 'Indie'], 'Inherit a farm and build a new life in the countryside.'),
]


class Command(BaseCommand):
    help = 'Load sample movies and games'

    def handle(self, *args, **options):
        def genres(names):
            return [Genre.objects.get_or_create(name=n)[0] for n in names]

        for name, year, creator, runtime, gs, desc in MOVIES:
            t, _ = Title.objects.get_or_create(
                name=name, media_type='movie',
                defaults=dict(release_date=date(year, 1, 1), creator=creator,
                              runtime_minutes=runtime, description=desc))
            t.genres.set(genres(gs))
        for name, year, creator, platforms, gs, desc in GAMES:
            t, _ = Title.objects.get_or_create(
                name=name, media_type='game',
                defaults=dict(release_date=date(year, 1, 1), creator=creator,
                              platforms=platforms, description=desc))
            t.genres.set(genres(gs))
        self.stdout.write(self.style.SUCCESS(f'{Title.objects.count()} titles in database'))
