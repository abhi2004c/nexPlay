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
    avatar_version = models.PositiveIntegerField(default=0)  # 0 = no uploaded picture; bumped on every change


class Avatar(models.Model):
    """An uploaded profile picture, kept out of the User row so ordinary user lookups stay light."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='avatar')
    data = models.BinaryField()  # a small square JPEG (the browser resizes it to 256x256 before upload)
    updated_at = models.DateTimeField(auto_now=True)
