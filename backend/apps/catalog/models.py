from django.db import models
from django.utils.text import slugify


class Genre(models.Model):
    name = models.CharField(max_length=60, unique=True)

    def __str__(self):
        return self.name


class Title(models.Model):
    """A movie or a video game."""

    class MediaType(models.TextChoices):
        MOVIE = 'movie', 'Movie'
        GAME = 'game', 'Game'

    media_type = models.CharField(max_length=10, choices=MediaType.choices)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True)
    description = models.TextField(blank=True)
    release_date = models.DateField(null=True, blank=True)
    poster_url = models.URLField(blank=True)  # portrait: movie poster / Steam box-art
    backdrop_url = models.URLField(blank=True)  # landscape 16:9: TMDB backdrop / RAWG screenshot
    genres = models.ManyToManyField(Genre, related_name='titles', blank=True)
    creator = models.CharField(max_length=150, blank=True)  # director / developer
    runtime_minutes = models.PositiveIntegerField(null=True, blank=True)  # movies
    platforms = models.CharField(max_length=200, blank=True)  # games
    external_id = models.CharField(max_length=60, blank=True)  # TMDB / RAWG id
    external_rating = models.FloatField(null=True, blank=True)  # TMDB (movies) / RAWG x2 (games), 0-10
    external_votes = models.PositiveIntegerField(default=0)
    steam_app_id = models.CharField(max_length=20, blank=True)  # for player counts
    cheapshark_id = models.CharField(max_length=30, blank=True)  # for prices
    is_free = models.BooleanField(default=False)  # free-to-play game
    screenshots = models.JSONField(default=list, blank=True)  # [url, ...]
    metacritic = models.PositiveSmallIntegerField(null=True, blank=True)
    metacritic_url = models.URLField(blank=True)
    store_links = models.JSONField(default=list, blank=True)  # [{'name','url'}] for free games
    avg_rating = models.FloatField(default=0)
    rating_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-release_date', 'name']

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(f'{self.name}-{self.media_type}')
            slug, n = base, 1
            while Title.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f'{base}-{n}'
            self.slug = slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.media_type})'
