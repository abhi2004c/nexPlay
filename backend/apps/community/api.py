from django.db.models import Count
from rest_framework import permissions, serializers, viewsets
from rest_framework.response import Response

from apps.catalog.models import Title

from .models import Comment, Thread, WatchlistItem


class WatchlistSerializer(serializers.ModelSerializer):
    title_slug = serializers.SlugRelatedField(
        source='title', slug_field='slug', queryset=Title.objects.all()
    )
    title_name = serializers.CharField(source='title.name', read_only=True)

    class Meta:
        model = WatchlistItem
        fields = ('id', 'title_slug', 'title_name', 'status', 'added_at')


class WatchlistViewSet(viewsets.ModelViewSet):
    """The logged-in user's own watchlist."""

    serializer_class = WatchlistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WatchlistItem.objects.filter(user=self.request.user).select_related('title')

    def create(self, request, *args, **kwargs):
        """Adding a title that is already on the list is not an error: return the existing entry."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item, created = WatchlistItem.objects.get_or_create(
            user=request.user, title=serializer.validated_data['title'],
            defaults={'status': serializer.validated_data.get('status', WatchlistItem.Status.PLANNED)},
        )
        return Response(self.get_serializer(item).data, status=201 if created else 200)


class IsAuthorOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or obj.author_id == request.user.id


class ThreadSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source='author.username', read_only=True)
    title_slug = serializers.SlugRelatedField(
        source='title', slug_field='slug', queryset=Title.objects.all(), required=False, allow_null=True
    )
    comment_count = serializers.SerializerMethodField()

    class Meta:
        model = Thread
        fields = ('id', 'author', 'title_slug', 'subject', 'body', 'comment_count', 'created_at')

    def get_comment_count(self, obj):  # annotated by the viewset; one query for the whole list
        n = getattr(obj, 'comment_total', None)
        return n if n is not None else obj.comments.count()


class CommentSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = Comment
        fields = ('id', 'thread', 'author', 'body', 'created_at')


class ThreadViewSet(viewsets.ModelViewSet):
    """GET /api/threads/?title=<slug>"""

    serializer_class = ThreadSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_queryset(self):
        qs = Thread.objects.select_related('author', 'title').annotate(comment_total=Count('comments'))
        if self.request.query_params.get('title'):
            qs = qs.filter(title__slug=self.request.query_params['title'])
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class CommentViewSet(viewsets.ModelViewSet):
    """GET /api/comments/?thread=<id>"""

    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsAuthorOrReadOnly]

    def get_queryset(self):
        qs = Comment.objects.select_related('author')
        if self.request.query_params.get('thread'):
            qs = qs.filter(thread_id=self.request.query_params['thread'])
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
