"""Send email through a Google Apps Script relay (free hosts like Render block SMTP ports).

The relay (backend/email_relay.gs) runs under your own Google account and sends from your Gmail.
Set APPS_SCRIPT_URL and APPS_SCRIPT_SECRET. Without them the message is printed to the server log,
which is what you want in local development.
"""

import json
import os
import urllib.request


def send_email(to: str, subject: str, text: str) -> bool:
    url = os.environ.get('APPS_SCRIPT_URL', '')
    if not url:
        print(f'\n--- email (not sent: APPS_SCRIPT_URL not set) ---\nTo: {to}\n{subject}\n\n{text}\n---')
        return False
    payload = {'secret': os.environ.get('APPS_SCRIPT_SECRET', ''), 'to': to, 'subject': subject, 'body': text}
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), method='POST',
                                 headers={'content-type': 'application/json'})
    try:
        urllib.request.urlopen(req, timeout=20).read()  # Apps Script answers with a redirect; urllib follows it
        return True
    except Exception as e:  # never break the request because email failed
        print(f'email send failed: {e}')
        return False
