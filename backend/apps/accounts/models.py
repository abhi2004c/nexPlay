from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Visibility(models.TextChoices):
        PRIVATE = 'private', 'Only me'
        FRIENDS = 'friends', 'Friends'
        PUBLIC = 'public', 'Everyone'

    bio = models.TextField(blank=True)
    avatar_url = models.URLField(blank=True)
    # who may see this person's list (wishlist / playing / completed) on their profile
    list_visibility = models.CharField(max_length=8, choices=Visibility.choices, default=Visibility.FRIENDS)
    google_sub = models.CharField(max_length=64, unique=True, null=True, blank=True)  # Google account id
