"""Genre-affinity recommendations and similar-title lookup."""

import random
from collections import defaultdict

from django.db.models import Count

from apps.community.models import WatchlistItem
from apps.reviews.models import Review

from .cache_utils import cached
from .models import Title


def similar_titles(title, limit=6):
    genres = set(title.genres.values_list('id', flat=True))
    if not genres:
        return []
    scored = []
    # Only titles that share a genre, best overlap first, instead of scanning the whole catalog.
    candidates = (
        Title.objects.exclude(pk=title.pk).filter(genres__in=genres)
        .annotate(shared=Count('genres')).order_by('-shared', '-avg_rating')[:40]
        .prefetch_related('genres')
    )
    for t in candidates:
        g = {x.id for x in t.genres.all()}
        union = genres | g
        jaccard = len(genres & g) / len(union) if union else 0
        if jaccard:
            same_type = 0.1 if t.media_type == title.media_type else 0
            scored.append((jaccard + same_type + t.avg_rating / 100, t))
    scored.sort(key=lambda x: -x[0])
    return [t for _, t in scored[:limit]]


def recommend_for(user, limit=10):
    """Build a genre profile from the user's ratings (rating - 5 as weight) and watchlist."""
    weights = defaultdict(float)
    seen = set()
    for r in Review.objects.filter(user=user).prefetch_related('title__genres'):
        seen.add(r.title_id)
        for g in r.title.genres.all():
            weights[g.id] += r.rating - 5
    for w in WatchlistItem.objects.filter(user=user).prefetch_related('title__genres'):
        seen.add(w.title_id)
        for g in w.title.genres.all():
            weights[g.id] += 1  # mild interest signal

    if not weights:  # nothing to personalise on yet: show a fresh random selection
        return discover(limit, exclude=seen), False

    scored = []
    for t in Title.objects.exclude(pk__in=seen).prefetch_related('genres'):
        gs = list(t.genres.all())
        affinity = sum(weights.get(g.id, 0) for g in gs) / (len(gs) or 1)
        scored.append((affinity + t.avg_rating / 5, t))
    scored.sort(key=lambda x: -x[0])
    # Pick from the best matches at random, so a refresh shows different (still relevant) titles.
    best = [t for _, t in scored[:max(limit * 3, 24)]]
    return random.sample(best, min(limit, len(best))), True


def discover(limit=10, exclude=()):
    """A random selection of titles that have artwork. Different on every call."""
    pool = cached('discover_pool', 600,
                  lambda: list(Title.objects.exclude(poster_url='').values_list('id', flat=True)))
    ids = [i for i in pool if i not in set(exclude)]
    picked = random.sample(ids, min(limit, len(ids)))
    by_id = {t.id: t for t in Title.objects.filter(id__in=picked).prefetch_related('genres')}
    return [by_id[i] for i in picked if i in by_id]
