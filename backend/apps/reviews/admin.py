from django.contrib import admin

from .models import Review, ReviewReport

admin.site.register(Review)


@admin.register(ReviewReport)
class ReviewReportAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'reason', 'reporter', 'review', 'resolved')
    list_filter = ('resolved', 'reason')
    list_editable = ('resolved',)
    raw_id_fields = ('review', 'reporter')
