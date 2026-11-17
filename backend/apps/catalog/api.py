from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reviews.analysis import analyze

from .deals import deals_payload
from .media import media_payload
from .steam import steam_reviews_payload
from .recommend import recommend_for, similar_titles

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
            'metacritic', 'metacritic_url', 'steam_app_id',
        )


class TitleViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/titles/?media_type=movie|game&genre=Action&search=zelda&ordering=-avg_rating"""

    serializer_class = TitleSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        qs = Title.objects.all()
        if self.action in ('list', 'retrieve'):  # extra actions don't need the genre prefetch
            qs = qs.prefetch_related('genres')
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


    @action(detail=True, methods=['get'])
    def analysis(self, request, slug=None):
        return Response(analyze(self.get_object().reviews.all()))

    @action(detail=True, methods=['get'])
    def deals(self, request, slug=None):
        title = self.get_object()
        if title.media_type != 'game':
            return Response({'available': False})
        return Response(deals_payload(title))

    @action(detail=True, methods=['get'])
    def media(self, request, slug=None):
        return Response(media_payload(self.get_object()))

    @action(detail=True, methods=['get'], url_path='steam-reviews')
    def steam_reviews(self, request, slug=None):
        return Response(steam_reviews_payload(self.get_object()))

    @action(detail=True, methods=['get'])
    def similar(self, request, slug=None):
        return Response(TitleSerializer(similar_titles(self.get_object()), many=True).data)


class RecommendationsView(APIView):
    """Personalized for logged-in users; top-rated fallback otherwise."""

    permission_classes = [AllowAny]

    def get(self, request):
        if request.user.is_authenticated:
            titles, personalized = recommend_for(request.user)
        else:
            titles, personalized = list(Title.objects.order_by('-avg_rating', '-rating_count')[:10]), False
        return Response({'personalized': personalized, 'results': TitleSerializer(titles, many=True).data})


class GenreViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Genre.objects.all()
    serializer_class = GenreSerializer
    permission_classes = [AllowAny]
    pagination_class = None
