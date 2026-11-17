"""Search TMDB / RAWG and add a chosen title to the catalog (logged-in users only, rate limited)."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import importer
from .models import Title


class ExternalSearchView(APIView):
    """GET /api/external/search/?q=elden+ring&type=game|movie|all  -> matches; nothing is saved."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'external_search'

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        kind = request.query_params.get('type', 'all')
        if len(q) < 2:
            return Response({'detail': 'Type at least 2 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        kinds = ['game', 'movie'] if kind == 'all' else [kind] if kind in ('game', 'movie') else []
        if not kinds:
            return Response({'detail': 'type must be game, movie or all.'}, status=status.HTTP_400_BAD_REQUEST)

        results, errors = [], []
        for k in kinds:
            try:
                results += importer.search(q, k)
            except importer.ImportFailure as e:
                errors.append(str(e))
        if errors and not results:
            return Response({'detail': errors[0]}, status=status.HTTP_502_BAD_GATEWAY)

        # mark matches that are already in the catalog so the UI can open them directly
        existing = {
            (t.media_type, t.external_id): t.slug
            for t in Title.objects.filter(external_id__in=[r['external_id'] for r in results])
        }
        for r in results:
            r['existing_slug'] = existing.get((r['media_type'], r['external_id']))
        return Response({'results': results, 'warnings': errors})


class ExternalImportView(APIView):
    """POST /api/external/import/ {media_type, external_id} -> {slug}. Adds only the chosen title."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'external_import'

    def post(self, request):
        media_type = request.data.get('media_type')
        external_id = str(request.data.get('external_id') or '')
        if media_type not in ('game', 'movie') or not external_id.isdigit():
            return Response({'detail': 'Invalid title.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = Title.objects.filter(media_type=media_type, external_id=external_id).first()
        if existing:  # someone already added it: no new import
            return Response({'slug': existing.slug, 'created': False})
        try:
            title = importer.import_one(media_type, external_id)
        except importer.ImportFailure as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception:
            return Response({'detail': 'Could not import that title right now.'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'slug': title.slug, 'created': True}, status=status.HTTP_201_CREATED)
