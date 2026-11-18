"""Small server-side cache for public, non-personalised API data.

Every database query crosses the network to the hosted Postgres, so repeated page loads reuse
recent answers. Entries that change when a review is posted are cleared by `invalidate_title`.
"""

from django.core.cache import cache


def cached(key, ttl, build):
    """Return the cached value for `key`, or call build(), store it for `ttl` seconds and return it."""
    value = cache.get(key)
    if value is None:
        value = build()
        cache.set(key, value, ttl)
    return value


def invalidate_title(slug):
    cache.delete_many([f'title:{slug}', f'analysis:{slug}'])
