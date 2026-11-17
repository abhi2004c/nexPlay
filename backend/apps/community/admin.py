from django.contrib import admin

from .models import Comment, Thread, WatchlistItem

admin.site.register([WatchlistItem, Thread, Comment])
