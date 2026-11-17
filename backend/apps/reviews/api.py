from django.db.models import Avg, Count
from rest_framework import permissions, serializers, viewsets

from apps.catalog.models import Title

from .models import Review


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or obj.user_id == request.user.id


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    title_slug = serializers.SlugRelatedField(
        source='title', slug_field='slug', queryset=Title.objects.all()
    )

    class Meta:
        model = Review
        fields = ('id', 'username', 'title_slug', 'rating', 'body', 'contains_spoilers',
                  'sentiment', 'created_at', 'updated_at')
        read_only_fields = ('sentiment',)

    def validate(self, attrs):
        request = self.context['request']
        title = attrs.get('title')
        if not self.instance and Review.objects.filter(user=request.user, title=title).exists():
            raise serializers.ValidationError('You have already reviewed this title.')
        return attrs


def refresh_title_rating(title):
    agg = title.reviews.aggregate(avg=Avg('rating'), n=Count('id'))
    title.avg_rating = round(agg['avg'] or 0, 2)
    title.rating_count = agg['n']
    title.save(update_fields=['avg_rating', 'rating_count'])


class ReviewViewSet(viewsets.ModelViewSet):
    """GET /api/reviews/?title=<slug>&user=<username>"""

    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        qs = Review.objects.select_related('user', 'title')
        p = self.request.query_params
        if p.get('title'):
            qs = qs.filter(title__slug=p['title'])
        if p.get('user'):
            qs = qs.filter(user__username=p['user'])
        return qs

    def perform_create(self, serializer):
        review = serializer.save(user=self.request.user)
        refresh_title_rating(review.title)

    def perform_update(self, serializer):
        review = serializer.save()
        refresh_title_rating(review.title)

    def perform_destroy(self, instance):
        title = instance.title
        instance.delete()
        refresh_title_rating(title)
