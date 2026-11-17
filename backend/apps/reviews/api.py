from django.db import IntegrityError
from django.db.models import Avg, Count, Exists, OuterRef, Value, BooleanField
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.catalog.models import Title

from .analysis import sentiment_score
from .models import Review, ReviewVote

ONE_REVIEW = 'You have already reviewed this title. Edit your existing review instead.'


class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or obj.user_id == request.user.id


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    title_slug = serializers.SlugRelatedField(
        source='title', slug_field='slug', queryset=Title.objects.all()
    )
    helpful_count = serializers.SerializerMethodField()
    voted_by_me = serializers.SerializerMethodField()
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ('id', 'username', 'title_slug', 'rating', 'body', 'contains_spoilers',
                  'sentiment', 'helpful_count', 'voted_by_me', 'is_mine', 'created_at', 'updated_at')
        read_only_fields = ('sentiment',)

    # Annotated by the viewset on list/retrieve; falls back to a query right after create/update.
    def get_helpful_count(self, obj):
        n = getattr(obj, 'helpful_count', None)
        return n if n is not None else obj.votes.count()

    def get_voted_by_me(self, obj):
        v = getattr(obj, 'voted_by_me', None)
        if v is not None:
            return bool(v)
        user = self.context['request'].user
        return user.is_authenticated and obj.votes.filter(user=user).exists()

    def get_is_mine(self, obj):
        return obj.user_id == self.context['request'].user.id

    def validate(self, attrs):
        request = self.context['request']
        title = attrs.get('title')
        if self.instance:
            if title and title != self.instance.title:
                raise serializers.ValidationError('A review cannot be moved to another title.')
        elif Review.objects.filter(user=request.user, title=title).exists():
            raise serializers.ValidationError(ONE_REVIEW)
        return attrs


def refresh_title_rating(title):
    agg = title.reviews.aggregate(avg=Avg('rating'), n=Count('id'))
    title.avg_rating = round(agg['avg'] or 0, 2)
    title.rating_count = agg['n']
    title.save(update_fields=['avg_rating', 'rating_count'])


ORDERINGS = {
    'newest': ('-created_at',),
    'helpful': ('-helpful_count', '-created_at'),
    'rating_desc': ('-rating', '-created_at'),
    'rating_asc': ('rating', '-created_at'),
}


class ReviewViewSet(viewsets.ModelViewSet):
    """GET /api/reviews/?title=<slug>&user=<username>&ordering=newest|helpful|rating_desc|rating_asc"""

    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Review.objects.select_related('user', 'title').annotate(
            helpful_count=Count('votes', distinct=True),
            voted_by_me=(
                Exists(ReviewVote.objects.filter(review=OuterRef('pk'), user=user))
                if user.is_authenticated else Value(False, output_field=BooleanField())
            ),
        )
        p = self.request.query_params
        if p.get('title'):
            qs = qs.filter(title__slug=p['title'])
        if p.get('user'):
            qs = qs.filter(user__username=p['user'])
        return qs.order_by(*ORDERINGS.get(p.get('ordering'), ORDERINGS['newest']))

    def perform_create(self, serializer):
        try:
            review = serializer.save(
                user=self.request.user,
                sentiment=sentiment_score(serializer.validated_data.get('body')),
            )
        except IntegrityError:  # two posts at once: the database constraint is the final guard
            raise serializers.ValidationError(ONE_REVIEW)
        refresh_title_rating(review.title)

    def perform_update(self, serializer):
        body = serializer.validated_data.get('body', serializer.instance.body)
        review = serializer.save(sentiment=sentiment_score(body))
        refresh_title_rating(review.title)

    def perform_destroy(self, instance):
        title = instance.title
        instance.delete()
        refresh_title_rating(title)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def vote(self, request, pk=None):
        """Toggle a 'helpful' vote on someone else's review."""
        review = self.get_object()
        if review.user_id == request.user.id:
            return Response({'detail': 'You cannot vote on your own review.'}, status=400)
        vote, created = ReviewVote.objects.get_or_create(review=review, user=request.user)
        if not created:
            vote.delete()
        return Response({'voted_by_me': created, 'helpful_count': review.votes.count()})
