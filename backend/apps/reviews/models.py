from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    title = models.ForeignKey('catalog.Title', on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    body = models.TextField(blank=True)
    contains_spoilers = models.BooleanField(default=False)
    sentiment = models.FloatField(null=True, blank=True)  # -1..1, set by review analysis
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user', 'title'], name='one_review_per_user_title')]

    def __str__(self):
        return f'{self.user} -> {self.title}: {self.rating}'


class ReviewVote(models.Model):
    """A user marking someone else's review as helpful (one vote per user per review)."""

    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='review_votes')
    value = models.SmallIntegerField(default=1)  # +1 helpful, -1 not helpful
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['review', 'user'], name='one_vote_per_user_review'),
            models.CheckConstraint(condition=models.Q(value__in=[1, -1]), name='vote_value_is_plus_or_minus_one'),
        ]
