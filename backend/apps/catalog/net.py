"""Small HTTP-JSON helper (stdlib only) with a TLS 1.2 retry for networks that drop TLS 1.3."""

import json
import ssl
import urllib.error
import urllib.request


def _open(req, context=None):
    with urllib.request.urlopen(req, timeout=20, context=context) as resp:
        return json.load(resp)


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'NexPlay/1.0', **(headers or {})})
    try:
        return _open(req)
    except urllib.error.URLError as e:
        if not isinstance(e.reason, ssl.SSLError):
            raise
        ctx = ssl.create_default_context()
        ctx.maximum_version = ssl.TLSVersion.TLSv1_2
        return _open(req, ctx)
