from django.conf import settings
from django.db import models


class WatchlistItem(models.Model):
    class Status(models.TextChoices):
        PLANNED = 'planned', 'Plan to watch/play'
        IN_PROGRESS = 'in_progress', 'Watching/Playing'
        COMPLETED = 'completed', 'Completed'
        DROPPED = 'dropped', 'Dropped'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='watchlist')
    title = models.ForeignKey('catalog.Title', on_delete=models.CASCADE, related_name='watchlisted_by')
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PLANNED)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'title'], name='one_watchlist_entry')]


class Thread(models.Model):
    title = models.ForeignKey('catalog.Title', on_delete=models.CASCADE, related_name='threads', null=True, blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='threads')
    subject = models.CharField(max_length=200)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Comment(models.Model):
    thread = models.ForeignKey(Thread, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments')
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
