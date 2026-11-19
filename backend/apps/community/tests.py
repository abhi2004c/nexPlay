import re
import threading
import time
from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.catalog.models import Title
from apps.community import social
from apps.community.models import WatchlistItem
from apps.reviews.models import Review, ReviewReport

PW = 'Sup3r-secret-pw'


def make_user(name):
    return User.objects.create_user(name, f'{name}@example.com', PW)


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


class SocialTests(TestCase):
    def setUp(self):
        self.ann, self.bob, self.cat = make_user('ann'), make_user('bob'), make_user('cat')
        self.title = Title.objects.create(name='Heat', slug='heat', media_type='movie')
        WatchlistItem.objects.create(user=self.ann, title=self.title, status='completed')

    def befriend(self, a, b):
        client_for(a).post('/api/friends/request/', {'username': b.username})
        req = client_for(b).get('/api/friends/').json()['incoming'][0]
        self.assertEqual(client_for(b).post(f"/api/friends/{req['id']}/accept/").status_code, 200)

    def test_list_hidden_from_strangers_and_reveals_nothing(self):
        data = client_for(self.bob).get('/api/users/ann/').json()
        self.assertFalse(data['list_visible'])
        self.assertNotIn('list', data)
        self.assertNotIn('list_counts', data)

    def test_private_hides_from_friends_too_and_friends_can_see_when_allowed(self):
        self.befriend(self.ann, self.bob)
        self.assertTrue(client_for(self.bob).get('/api/users/ann/').json()['list_visible'])  # default: friends
        client_for(self.ann).patch('/api/auth/me/', {'list_visibility': 'private'}, format='json')
        self.assertFalse(client_for(self.bob).get('/api/users/ann/').json()['list_visible'])
        self.assertTrue(client_for(self.ann).get('/api/users/ann/').json()['list_visible'])  # owner always

    def test_public_visibility_is_refused(self):
        r = client_for(self.ann).patch('/api/auth/me/', {'list_visibility': 'public'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_cannot_friend_yourself_or_accept_someone_elses_request(self):
        self.assertEqual(client_for(self.ann).post('/api/friends/request/', {'username': 'ann'}).status_code, 400)
        client_for(self.bob).post('/api/friends/request/', {'username': 'ann'})
        req_id = client_for(self.ann).get('/api/friends/').json()['incoming'][0]['id']
        self.assertEqual(client_for(self.cat).post(f'/api/friends/{req_id}/accept/').status_code, 404)

    def test_chat_is_friends_only_and_shares_titles(self):
        self.assertEqual(client_for(self.cat).get('/api/messages/with/bob/').status_code, 403)
        self.befriend(self.ann, self.bob)
        r = client_for(self.bob).post('/api/messages/with/ann/', {'body': 'seen it?', 'title_slug': 'heat'})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['title']['name'], 'Heat')
        self.assertEqual(client_for(self.ann).get('/api/messages/unread/').json()['unread'], 1)
        msgs = client_for(self.ann).get('/api/messages/with/bob/').json()['messages']
        self.assertEqual([m['body'] for m in msgs], ['seen it?'])
        self.assertEqual(client_for(self.ann).get('/api/messages/unread/').json()['unread'], 0)
        self.assertEqual(client_for(self.bob).post('/api/messages/with/ann/', {}).status_code, 400)  # empty message

    def test_waiting_reader_is_woken_by_a_new_message(self):
        seen = social._message_counter
        result = {}
        t = threading.Thread(target=lambda: result.update(ok=social._wait_for_message(seen)))
        t.start()
        time.sleep(0.2)
        started = time.time()
        social._announce_message()
        t.join(3)
        self.assertFalse(t.is_alive())
        self.assertTrue(result['ok'])
        self.assertLess(time.time() - started, 1)

    def test_no_wait_slot_means_immediate_fallback(self):
        with mock.patch.object(social, '_wait_slots', threading.BoundedSemaphore(0)):
            self.assertFalse(social._wait_for_message(social._message_counter))


class AccountTests(TestCase):
    def test_email_required_and_unique(self):
        c = APIClient()
        body = {'username': 'zed', 'password': PW}
        self.assertEqual(c.post('/api/auth/register/', body, format='json').status_code, 400)
        make_user('ann')
        self.assertEqual(c.post('/api/auth/register/', {**body, 'email': 'ANN@example.com'}, format='json').status_code, 400)
        self.assertEqual(c.post('/api/auth/register/', {**body, 'email': 'zed@example.com'}, format='json').status_code, 201)

    def test_password_reset_flow(self):
        make_user('ann')
        c = APIClient()
        with mock.patch('apps.accounts.api.send_email') as send:
            c.post('/api/auth/password-reset/', {'email': 'nobody@example.com'}, format='json')
            self.assertFalse(send.called)  # unknown email: same answer, nothing sent
            self.assertEqual(c.post('/api/auth/password-reset/', {'email': 'ann@example.com'}, format='json').status_code, 200)
            text = send.call_args[0][2]
        uid, token = re.search(r'/reset/([^/]+)/(\S+)', text).groups()
        confirm = '/api/auth/password-reset/confirm/'
        self.assertEqual(c.post(confirm, {'uid': uid, 'token': token, 'password': '123'}, format='json').status_code, 400)
        self.assertEqual(c.post(confirm, {'uid': uid, 'token': token, 'password': 'Brand-new-pw-77'}, format='json').status_code, 200)
        self.assertEqual(c.post(confirm, {'uid': uid, 'token': token, 'password': 'Another-pw-88x'}, format='json').status_code, 400)  # one use
        self.assertEqual(c.post('/api/auth/token/', {'username': 'ann', 'password': 'Brand-new-pw-77'}, format='json').status_code, 200)

    def test_reset_link_uses_the_sites_own_address(self):
        make_user('ann')
        with mock.patch('apps.accounts.api.send_email') as send, self.settings(CORS_ALLOWED_ORIGINS=['https://nexplay.vercel.app']):
            APIClient().post('/api/auth/password-reset/', {'email': 'ann@example.com'}, format='json',
                             HTTP_ORIGIN='https://nexplay.vercel.app')
        self.assertIn('https://nexplay.vercel.app/reset/', send.call_args[0][2])

    def test_change_username_password_and_delete(self):
        ann, bob = make_user('ann'), make_user('bob')
        c = client_for(ann)
        self.assertEqual(c.patch('/api/auth/me/', {'username': 'BOB'}, format='json').status_code, 400)  # taken (any case)
        self.assertEqual(c.patch('/api/auth/me/', {'username': 'annie'}, format='json').status_code, 200)
        self.assertEqual(c.post('/api/auth/change-password/', {'current_password': 'wrong', 'new_password': 'Brand-new-pw-77'}, format='json').status_code, 400)
        self.assertEqual(c.post('/api/auth/change-password/', {'current_password': PW, 'new_password': 'Brand-new-pw-77'}, format='json').status_code, 200)
        title = Title.objects.create(name='Heat', slug='heat', media_type='movie')
        Review.objects.create(user=ann, title=title, rating=10)
        Review.objects.create(user=bob, title=title, rating=4)
        self.assertEqual(c.post('/api/auth/delete-account/', {'password': 'nope'}, format='json').status_code, 400)
        self.assertEqual(c.post('/api/auth/delete-account/', {'password': 'Brand-new-pw-77'}, format='json').status_code, 204)
        self.assertFalse(User.objects.filter(username='annie').exists())
        title.refresh_from_db()
        self.assertEqual((title.rating_count, float(title.avg_rating)), (1, 4.0))  # averages recomputed

    def test_health_check(self):
        self.assertEqual(APIClient().get('/api/health/').json(), {'status': 'ok'})


class ReviewReportTests(TestCase):
    def test_report_once_not_own(self):
        ann, bob = make_user('ann'), make_user('bob')
        title = Title.objects.create(name='Heat', slug='heat', media_type='movie')
        r = Review.objects.create(user=ann, title=title, rating=5, body='x', contains_spoilers=True)
        self.assertEqual(client_for(ann).post(f'/api/reviews/{r.id}/report/', {'reason': 'spam'}).status_code, 400)
        self.assertEqual(client_for(bob).post(f'/api/reviews/{r.id}/report/', {'reason': 'spam'}).status_code, 201)
        self.assertEqual(client_for(bob).post(f'/api/reviews/{r.id}/report/', {'reason': 'spam'}).status_code, 200)
        self.assertEqual(ReviewReport.objects.count(), 1)
        self.assertTrue(client_for(bob).get('/api/reviews/?title=heat').json()['results'][0]['contains_spoilers'])


class AvatarTests(TestCase):
    JPEG = bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b'fake-jpeg-body' * 10

    def upload(self, client, blob):
        import base64
        return client.post('/api/auth/avatar/', {'data': 'data:image/jpeg;base64,' + base64.b64encode(blob).decode()}, format='json')

    def test_upload_serve_and_remove(self):
        ann = make_user('ann')
        c = client_for(ann)
        self.assertEqual(c.get('/api/auth/me/').json()['avatar_url'], '')
        r = self.upload(c, self.JPEG)
        self.assertEqual(r.status_code, 200)
        url = r.json()['avatar_url']
        self.assertTrue(url.startswith('/users/ann/avatar/?v=1'))
        pic = APIClient().get('/api/users/ann/avatar/')  # anyone can load it, no login
        self.assertEqual(pic.status_code, 200)
        self.assertEqual(pic['Content-Type'], 'image/jpeg')
        self.assertIn('immutable', pic['Cache-Control'])
        self.assertEqual(b''.join(pic.streaming_content) if pic.streaming else pic.content, self.JPEG)
        self.assertTrue(self.upload(c, self.JPEG).json()['avatar_url'].endswith('v=2'))  # new URL, so caches refresh
        self.assertEqual(c.delete('/api/auth/avatar/').json()['avatar_url'], '')
        self.assertEqual(APIClient().get('/api/users/ann/avatar/').status_code, 404)

    def test_rejects_bad_uploads_and_needs_login(self):
        ann = make_user('ann')
        c = client_for(ann)
        self.assertEqual(self.upload(c, b'GIF89a-not-a-jpeg').status_code, 400)
        self.assertEqual(self.upload(c, self.JPEG[:4] + b'x' * (151 * 1024)).status_code, 400)
        self.assertEqual(c.post('/api/auth/avatar/', {'data': '!!!not base64!!!'}, format='json').status_code, 400)
        self.assertEqual(APIClient().post('/api/auth/avatar/', {'data': 'x'}, format='json').status_code, 401)

    def test_picture_shows_on_profile_and_friend_lists(self):
        ann, bob = make_user('ann'), make_user('bob')
        self.upload(client_for(ann), self.JPEG)
        self.assertTrue(client_for(bob).get('/api/users/ann/').json()['avatar_url'].startswith('/users/ann/avatar/'))

    def test_deleting_account_removes_picture(self):
        from apps.accounts.models import Avatar
        ann = make_user('ann')
        self.upload(client_for(ann), self.JPEG)
        client_for(ann).post('/api/auth/delete-account/', {'password': PW}, format='json')
        self.assertEqual(Avatar.objects.count(), 0)
