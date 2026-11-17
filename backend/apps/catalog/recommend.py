"""Genre-affinity recommendations and similar-title lookup."""

from collections import defaultdict

from apps.community.models import WatchlistItem
from apps.reviews.models import Review

from .models import Title


def similar_titles(title, limit=6):
    genres = set(title.genres.values_list('id', flat=True))
    if not genres:
        return []
    scored = []
    for t in Title.objects.exclude(pk=title.pk).prefetch_related('genres'):
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

    candidates = Title.objects.exclude(pk__in=seen).prefetch_related('genres')
    if not weights:  # cold start: top rated
        return list(candidates.order_by('-avg_rating', '-rating_count')[:limit]), False

    scored = []
    for t in candidates:
        gs = list(t.genres.all())
        affinity = sum(weights.get(g.id, 0) for g in gs) / (len(gs) or 1)
        scored.append((affinity + t.avg_rating / 5, t))
    scored.sort(key=lambda x: -x[0])
    return [t for _, t in scored[:limit]], True
