import json
import os
import re
import urllib.parse
import urllib.request

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .mail import send_email
from .models import User


class UserSerializer(serializers.ModelSerializer):
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'bio', 'avatar_url', 'list_visibility', 'has_password')
        read_only_fields = ('email',)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError('That username is taken.')
        return value

    def validate_list_visibility(self, value):
        if value not in ('private', 'friends'):  # lists are never public
            raise serializers.ValidationError('Choose "Only me" or "My friends".')
        return value

    def get_has_password(self, u):
        return u.has_usable_password()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=True)  # needed so a forgotten password can be reset

    class Meta:
        model = User
        fields = ('username', 'email', 'password')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, data):
        return User.objects.create_user(**data)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        s = UserSerializer(request.user, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class AuthThrottle(AnonRateThrottle):
    scope = 'auth_email'


def _token_for(user):
    return str(RefreshToken.for_user(user).access_token)


class PasswordResetRequestView(APIView):
    """POST {email}. Always answers the same way so nobody can probe which emails have accounts."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        for user in User.objects.filter(email__iexact=email, is_active=True)[:1]:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)  # expires after 3 days, dies once the password changes
            # link back to the site the person is actually on (the browser tells us), else FRONTEND_URL
            origin = (request.headers.get('Origin') or '').rstrip('/')
            allowed = [o.rstrip('/') for o in settings.CORS_ALLOWED_ORIGINS]
            base = origin if origin in allowed else os.environ.get('FRONTEND_URL', 'http://localhost:5173').rstrip('/')
            send_email(
                user.email, 'Reset your NexPlay password',
                f'Hi {user.username},\n\nUse this link to choose a new password:\n{base}/reset/{uid}/{token}\n\n'
                'If you did not ask for this, ignore this email; your password stays the same.',
            )
        return Response({'detail': 'If that email has an account, a reset link is on its way.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(request.data.get('uid', ''))))
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            user = None
        if user is None or not default_token_generator.check_token(user, request.data.get('token', '')):
            return Response({'detail': 'This reset link is invalid or has expired. Please request a new one.'}, status=400)
        password = request.data.get('password', '')
        try:
            validate_password(password, user)
        except Exception as e:
            return Response({'detail': ' '.join(getattr(e, 'messages', [str(e)]))}, status=400)
        user.set_password(password)
        user.save()
        return Response({'detail': 'Password changed. You can log in now.'})


def _username_from(email: str) -> str:
    base = re.sub(r'[^\w.@+-]', '', email.split('@')[0])[:24] or 'user'
    name, n = base, 1
    while User.objects.filter(username__iexact=name).exists():
        n += 1
        name = f'{base}{n}'
    return name


class GoogleLoginView(APIView):
    """POST {credential}: the ID token from Sign in with Google. Returns a NexPlay access token."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthThrottle]

    def post(self, request):
        client_id = os.environ.get('GOOGLE_CLIENT_ID', '')
        credential = request.data.get('credential', '')
        if not client_id:
            return Response({'detail': 'Google sign-in is not configured on the server.'}, status=503)
        try:  # Google validates the signature and expiry for us
            url = 'https://oauth2.googleapis.com/tokeninfo?' + urllib.parse.urlencode({'id_token': credential})
            info = json.loads(urllib.request.urlopen(url, timeout=10).read())
        except Exception:
            return Response({'detail': 'Google could not verify that sign-in.'}, status=400)
        if info.get('aud') != client_id or str(info.get('email_verified')).lower() != 'true':
            return Response({'detail': 'Google sign-in was rejected.'}, status=400)
        sub, email = info['sub'], info.get('email', '')
        user = User.objects.filter(google_sub=sub).first()
        if user is None and email:  # same email as an existing account: link them
            user = User.objects.filter(email__iexact=email).first()
            if user:
                user.google_sub = sub
                user.save(update_fields=['google_sub'])
        if user is None:
            user = User(username=_username_from(email or sub), email=email, google_sub=sub,
                        avatar_url=info.get('picture', ''))
            user.set_unusable_password()
            user.save()
        return Response({'access': _token_for(user)})


class ChangePasswordView(APIView):
    """POST {current_password, new_password}. Accounts made with Google (no password yet) can set one without the current."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.has_usable_password() and not user.check_password(request.data.get('current_password', '')):
            return Response({'detail': 'Your current password is wrong.'}, status=400)
        new = request.data.get('new_password', '')
        try:
            validate_password(new, user)
        except Exception as e:
            return Response({'detail': ' '.join(getattr(e, 'messages', [str(e)]))}, status=400)
        user.set_password(new)
        user.save()
        return Response({'detail': 'Password changed.'})


class DeleteAccountView(APIView):
    """POST {password} (or {confirm: <username>} for Google accounts). Removes the account and everything it posted."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.reviews.api import refresh_title_rating  # imported here to avoid a circular import
        user = request.user
        if user.has_usable_password():
            if not user.check_password(request.data.get('password', '')):
                return Response({'detail': 'Wrong password.'}, status=400)
        elif request.data.get('confirm') != user.username:
            return Response({'detail': 'Type your username to confirm.'}, status=400)
        titles = list({r.title for r in user.reviews.select_related('title')})
        user.delete()
        for t in titles:  # their reviews are gone, so the averages must be recomputed
            refresh_title_rating(t)
        return Response(status=204)
