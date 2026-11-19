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


class Friendship(models.Model):
    """A friend request; once accepted the two people are friends (one row per pair)."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ACCEPTED = 'accepted', 'Accepted'

    from_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='friend_requests_sent')
    to_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='friend_requests_received')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['from_user', 'to_user'], name='one_request_per_direction'),
            models.CheckConstraint(condition=~models.Q(from_user=models.F('to_user')), name='no_self_friend'),
        ]


class Message(models.Model):
    """A chat message between two friends; may carry a movie/game to recommend or ask about."""

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages_sent')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='messages_received')
    body = models.TextField(blank=True, max_length=2000)
    title = models.ForeignKey('catalog.Title', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        indexes = [models.Index(fields=['recipient', 'sender', 'created_at'])]
