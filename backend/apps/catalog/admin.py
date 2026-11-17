from django.contrib import admin

from .models import Genre, Title

admin.site.register(Genre)


@admin.register(Title)
class TitleAdmin(admin.ModelAdmin):
    list_display = ("name", "media_type", "release_date", "avg_rating")
    list_filter = ("media_type", "genres")
    search_fields = ("name",)
