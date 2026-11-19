"""Profiles, friends and chat."""

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.catalog.api import TitleSerializer
from apps.catalog.models import Title
from apps.reviews.models import Review

from .models import Friendship, Message, WatchlistItem

IsAuth = [permissions.IsAuthenticated]


def friendship_between(a, b):
    return Friendship.objects.filter(Q(from_user=a, to_user=b) | Q(from_user=b, to_user=a)).first()


def are_friends(a, b):
    f = friendship_between(a, b)
    return bool(f and f.status == Friendship.Status.ACCEPTED)


def friend_ids(user):
    rows = Friendship.objects.filter(status='accepted').filter(Q(from_user=user) | Q(to_user=user))
    return {r.to_user_id if r.from_user_id == user.id else r.from_user_id for r in rows}


def mini(u):
    return {'username': u.username, 'avatar_url': u.avatar_url}


def can_see_list(viewer, owner):
    if viewer.is_authenticated and viewer.id == owner.id:
        return True
    if owner.list_visibility == User.Visibility.PUBLIC:
        return True
    return owner.list_visibility == User.Visibility.FRIENDS and viewer.is_authenticated and are_friends(viewer, owner)


class ProfileView(APIView):
    """GET /api/users/<username>/ : public profile; the list is included only if its owner allows it."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        owner = get_object_or_404(User, username__iexact=username, is_active=True)
        viewer = request.user
        me = viewer.is_authenticated and viewer.id == owner.id
        relation, request_id = 'none', None
        if me:
            relation = 'self'
        elif viewer.is_authenticated:
            f = friendship_between(viewer, owner)
            if f:
                request_id = f.id
                relation = 'friends' if f.status == 'accepted' else ('request_sent' if f.from_user_id == viewer.id else 'request_received')

        data = {
            'username': owner.username, 'bio': owner.bio, 'avatar_url': owner.avatar_url,
            'joined': owner.date_joined, 'relation': relation, 'request_id': request_id,
            'list_visibility': owner.list_visibility,
            'friend_count': len(friend_ids(owner)),
        }
        allowed = can_see_list(viewer, owner)
        data['list_visible'] = allowed
        if allowed:
            items = WatchlistItem.objects.filter(user=owner).select_related('title').prefetch_related('title__genres')
            data['list'] = [{'status': i.status, 'title': TitleSerializer(i.title).data} for i in items]
        # when hidden, nothing about the list is revealed: no titles and no counts
        reviews = Review.objects.filter(user=owner).select_related('title').order_by('-created_at')[:10]
        data['reviews'] = [
            {'id': r.id, 'rating': r.rating, 'body': r.body, 'created_at': r.created_at,
             'title_slug': r.title.slug, 'title_name': r.title.name, 'poster_url': r.title.poster_url,
             'media_type': r.title.media_type}
            for r in reviews
        ]
        return Response(data)


class FriendsView(APIView):
    """GET /api/friends/ : friends, incoming and outgoing requests."""

    permission_classes = IsAuth

    def get(self, request):
        rows = Friendship.objects.filter(Q(from_user=request.user) | Q(to_user=request.user)).select_related('from_user', 'to_user')
        friends, incoming, outgoing = [], [], []
        for f in rows:
            mine = f.from_user_id == request.user.id
            other = f.to_user if mine else f.from_user
            entry = {'id': f.id, **mini(other)}
            if f.status == 'accepted':
                friends.append(entry)
            elif mine:
                outgoing.append(entry)
            else:
                incoming.append(entry)
        friends.sort(key=lambda e: e['username'].lower())
        return Response({'friends': friends, 'incoming': incoming, 'outgoing': outgoing})


class FriendRequestView(APIView):
    """POST /api/friends/request/ {username}"""

    permission_classes = IsAuth

    def post(self, request):
        other = get_object_or_404(User, username__iexact=request.data.get('username', ''), is_active=True)
        if other.id == request.user.id:
            return Response({'detail': 'You cannot add yourself.'}, status=400)
        existing = friendship_between(request.user, other)
        if existing:
            if existing.status == 'pending' and existing.to_user_id == request.user.id:  # they already asked: accept
                existing.status = 'accepted'
                existing.save(update_fields=['status'])
                return Response({'detail': 'You are now friends.', 'relation': 'friends', 'request_id': existing.id})
            rel = 'friends' if existing.status == 'accepted' else 'request_sent'
            return Response({'detail': 'Already requested.', 'relation': rel, 'request_id': existing.id})
        f = Friendship.objects.create(from_user=request.user, to_user=other)
        return Response({'detail': 'Friend request sent.', 'relation': 'request_sent', 'request_id': f.id}, status=201)


class FriendAcceptView(APIView):
    permission_classes = IsAuth

    def post(self, request, pk):
        f = get_object_or_404(Friendship, pk=pk, to_user=request.user, status='pending')
        f.status = 'accepted'
        f.save(update_fields=['status'])
        return Response({'relation': 'friends', 'request_id': f.id})


class FriendDeleteView(APIView):
    """DELETE /api/friends/<id>/ : decline a request, cancel one you sent, or unfriend."""

    permission_classes = IsAuth

    def delete(self, request, pk):
        f = get_object_or_404(Friendship, Q(from_user=request.user) | Q(to_user=request.user), pk=pk)
        f.delete()
        return Response(status=204)


def message_json(m, me):
    return {
        'id': m.id, 'mine': m.sender_id == me.id, 'body': m.body, 'created_at': m.created_at,
        'title': TitleSerializer(m.title).data if m.title_id else None,
    }


class ConversationsView(APIView):
    """GET /api/messages/ : every friend with the latest message and unread count (friends with no chat yet too)."""

    permission_classes = IsAuth

    def get(self, request):
        me = request.user
        ids = friend_ids(me)
        users = {u.id: u for u in User.objects.filter(id__in=ids)}
        last, unread = {}, {}
        msgs = Message.objects.filter(Q(sender=me) | Q(recipient=me)).select_related('title').order_by('-created_at')[:500]
        for m in msgs:
            other = m.recipient_id if m.sender_id == me.id else m.sender_id
            if other in users and other not in last:
                last[other] = m
        for row in Message.objects.filter(recipient=me, read_at__isnull=True).values('sender').annotate(n=Count('id')):
            unread[row['sender']] = row['n']
        out = []
        for uid, u in users.items():
            m = last.get(uid)
            preview = ''
            if m:
                preview = ('You: ' if m.sender_id == me.id else '') + (m.body or (f'Shared {m.title.name}' if m.title else ''))
            out.append({**mini(u), 'unread': unread.get(uid, 0), 'preview': preview[:80],
                        'last_at': m.created_at if m else None})
        out.sort(key=lambda e: (e['last_at'] is None, -(e['last_at'].timestamp() if e['last_at'] else 0), e['username'].lower()))
        return Response(out)


class UnreadView(APIView):
    permission_classes = IsAuth

    def get(self, request):
        return Response({'unread': Message.objects.filter(recipient=request.user, read_at__isnull=True).count()})


class ChatView(APIView):
    """GET /api/messages/with/<username>/?after=<id> to read; POST {body, title_slug} to send. Friends only."""

    permission_classes = IsAuth

    def _friend(self, request, username):
        other = get_object_or_404(User, username__iexact=username, is_active=True)
        if not are_friends(request.user, other):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You can only chat with friends.')
        return other

    def get(self, request, username):
        other = self._friend(request, username)
        me = request.user
        Message.objects.filter(sender=other, recipient=me, read_at__isnull=True).update(read_at=timezone.now())
        qs = Message.objects.filter(Q(sender=me, recipient=other) | Q(sender=other, recipient=me)).select_related('title')
        after = request.query_params.get('after')
        if after and after.isdigit():
            qs = qs.filter(id__gt=int(after))
        else:
            qs = qs.order_by('-created_at')[:100]
            qs = sorted(qs, key=lambda m: m.id)  # latest 100, oldest first
        return Response({'friend': mini(other), 'messages': [message_json(m, me) for m in qs]})

    def post(self, request, username):
        other = self._friend(request, username)
        body = (request.data.get('body') or '').strip()[:2000]
        title = None
        if request.data.get('title_slug'):
            title = get_object_or_404(Title, slug=request.data['title_slug'])
        if not body and not title:
            return Response({'detail': 'Write something or share a title.'}, status=400)
        m = Message.objects.create(sender=request.user, recipient=other, body=body, title=title)
        return Response(message_json(m, request.user), status=201)
