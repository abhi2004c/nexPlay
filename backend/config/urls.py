from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.api import (GoogleLoginView, MeView, PasswordResetConfirmView, PasswordResetRequestView,
                               RegisterView)
from apps.community.social import (ChatView, ConversationsView, FriendAcceptView, FriendDeleteView,
                                   FriendRequestView, FriendsView, ProfileView, UnreadView)
from apps.catalog.external import ExternalImportView, ExternalSearchView
from apps.catalog.api import GenreViewSet, RecommendationsView, TitleViewSet
from apps.community.api import CommentViewSet, ThreadViewSet, WatchlistViewSet
from apps.reviews.api import ReviewViewSet

router = DefaultRouter()
router.register('titles', TitleViewSet, basename='title')
router.register('genres', GenreViewSet, basename='genre')
router.register('reviews', ReviewViewSet, basename='review')
router.register('watchlist', WatchlistViewSet, basename='watchlist')
router.register('threads', ThreadViewSet, basename='thread')
router.register('comments', CommentViewSet, basename='comment')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/register/', RegisterView.as_view()),
    path('api/auth/token/', TokenObtainPairView.as_view()),
    path('api/auth/token/refresh/', TokenRefreshView.as_view()),
    path('api/auth/me/', MeView.as_view()),
    path('api/auth/google/', GoogleLoginView.as_view()),
    path('api/auth/password-reset/', PasswordResetRequestView.as_view()),
    path('api/auth/password-reset/confirm/', PasswordResetConfirmView.as_view()),
    path('api/users/<str:username>/', ProfileView.as_view()),
    path('api/friends/', FriendsView.as_view()),
    path('api/friends/request/', FriendRequestView.as_view()),
    path('api/friends/<int:pk>/accept/', FriendAcceptView.as_view()),
    path('api/friends/<int:pk>/', FriendDeleteView.as_view()),
    path('api/messages/', ConversationsView.as_view()),
    path('api/messages/unread/', UnreadView.as_view()),
    path('api/messages/with/<str:username>/', ChatView.as_view()),
    path('api/external/search/', ExternalSearchView.as_view()),
    path('api/external/import/', ExternalImportView.as_view()),
    path('api/recommendations/', RecommendationsView.as_view()),
    path('api/', include(router.urls)),
]
