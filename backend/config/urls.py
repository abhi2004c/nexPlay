from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.api import MeView, RegisterView
from apps.catalog.api import GenreViewSet, TitleViewSet
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
    path('api/', include(router.urls)),
]
