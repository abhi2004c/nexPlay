from rest_framework import permissions, serializers, viewsets

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

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class IsAuthorOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in permissions.SAFE_METHODS or obj.author_id == request.user.id


class ThreadSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source='author.username', read_only=True)
    title_slug = serializers.SlugRelatedField(
        source='title', slug_field='slug', queryset=Title.objects.all(), required=False, allow_null=True
    )
    comment_count = serializers.IntegerField(source='comments.count', read_only=True)

    class Meta:
        model = Thread
        fields = ('id', 'author', 'title_slug', 'subject', 'body', 'comment_count', 'created_at')


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
        qs = Thread.objects.select_related('author', 'title')
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
