from rest_framework import serializers, viewsets
from rest_framework.permissions import AllowAny

from .models import Genre, Title


class GenreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genre
        fields = ('id', 'name')


class TitleSerializer(serializers.ModelSerializer):
    genres = serializers.SlugRelatedField(many=True, slug_field='name', read_only=True)

    class Meta:
        model = Title
        fields = (
            'id', 'slug', 'media_type', 'name', 'description', 'release_date', 'poster_url',
            'genres', 'creator', 'runtime_minutes', 'platforms', 'avg_rating', 'rating_count',
        )


class TitleViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/titles/?media_type=movie|game&genre=Action&search=zelda&ordering=-avg_rating"""

    serializer_class = TitleSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        qs = Title.objects.prefetch_related('genres')
        p = self.request.query_params
        if p.get('media_type'):
            qs = qs.filter(media_type=p['media_type'])
        if p.get('genre'):
            qs = qs.filter(genres__name__iexact=p['genre'])
        if p.get('search'):
            qs = qs.filter(name__icontains=p['search'])
        ordering = p.get('ordering')
        if ordering in {'avg_rating', '-avg_rating', 'release_date', '-release_date', 'name'}:
            qs = qs.order_by(ordering)
        return qs


class GenreViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Genre.objects.all()
    serializer_class = GenreSerializer
    permission_classes = [AllowAny]
    pagination_class = None
