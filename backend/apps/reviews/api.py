from django.db import IntegrityError
from django.db.models import Avg, Count, F, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.catalog.cache_utils import invalidate_title
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
    unhelpful_count = serializers.SerializerMethodField()
    my_vote = serializers.SerializerMethodField()  # 1, -1 or 0
    is_mine = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ('id', 'username', 'title_slug', 'rating', 'body', 'contains_spoilers', 'sentiment',
                  'helpful_count', 'unhelpful_count', 'my_vote', 'is_mine', 'created_at', 'updated_at')
        read_only_fields = ('sentiment',)

    # Annotated by the viewset on list/retrieve; falls back to queries right after create/update.
    def get_helpful_count(self, obj):
        n = getattr(obj, 'helpful_count', None)
        return n if n is not None else obj.votes.filter(value=1).count()

    def get_unhelpful_count(self, obj):
        n = getattr(obj, 'unhelpful_count', None)
        return n if n is not None else obj.votes.filter(value=-1).count()

    def get_my_vote(self, obj):
        v = getattr(obj, 'my_vote', None)
        if v is not None:
            return v
        user = self.context['request'].user
        if not user.is_authenticated:
            return 0
        vote = obj.votes.filter(user=user).first()
        return vote.value if vote else 0

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
    invalidate_title(title.slug)  # drop the cached detail/analysis so the new rating shows immediately


ORDERINGS = {
    'newest': ('-created_at',),
    'helpful': ('-score', '-created_at'),  # net votes: helpful minus not helpful
    'rating_desc': ('-rating', '-created_at'),
    'rating_asc': ('rating', '-created_at'),
}


class ReviewViewSet(viewsets.ModelViewSet):
    """GET /api/reviews/?title=<slug>&user=<username>&ordering=newest|helpful|rating_desc|rating_asc"""

    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            my_vote = Coalesce(
                Subquery(ReviewVote.objects.filter(review=OuterRef('pk'), user=user).values('value')[:1]),
                Value(0), output_field=IntegerField(),
            )
        else:
            my_vote = Value(0, output_field=IntegerField())
        qs = Review.objects.select_related('user', 'title').annotate(
            helpful_count=Count('votes', filter=Q(votes__value=1)),
            unhelpful_count=Count('votes', filter=Q(votes__value=-1)),
            my_vote=my_vote,
        ).annotate(score=F('helpful_count') - F('unhelpful_count'))
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
        """Vote on someone else's review: {"value": 1} helpful, {"value": -1} not helpful.

        Sending the same value again removes the vote; the other value switches it.
        """
        review = self.get_object()
        if review.user_id == request.user.id:
            return Response({'detail': 'You cannot vote on your own review.'}, status=400)
        try:
            value = int(request.data.get('value', 1))
        except (TypeError, ValueError):
            value = 0
        if value not in (1, -1):
            return Response({'detail': 'value must be 1 or -1.'}, status=400)

        vote, created = ReviewVote.objects.get_or_create(review=review, user=request.user, defaults={'value': value})
        if created:
            my_vote = value
        elif vote.value == value:
            vote.delete()
            my_vote = 0
        else:
            vote.value = value
            vote.save(update_fields=['value'])
            my_vote = value
        return Response({
            'my_vote': my_vote,
            'helpful_count': review.votes.filter(value=1).count(),
            'unhelpful_count': review.votes.filter(value=-1).count(),
        })
