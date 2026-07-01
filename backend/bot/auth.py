"""Kite Connect authentication helpers.

Zerodha's login is a two-step OAuth-ish flow:
  1. Open the login URL, log in, and Kite redirects to your app with a
     ?request_token=... in the URL.
  2. Exchange that request_token + api_secret for an access_token, which is
     valid until ~6am the next day. You must regenerate it daily.
"""
from __future__ import annotations

from kiteconnect import KiteConnect


def make_kite(api_key: str, access_token: str | None = None) -> KiteConnect:
    kite = KiteConnect(api_key=api_key)
    if access_token:
        kite.set_access_token(access_token)
    return kite


def login_url(api_key: str) -> str:
    return KiteConnect(api_key=api_key).login_url()


def generate_access_token(api_key: str, api_secret: str, request_token: str) -> str:
    kite = KiteConnect(api_key=api_key)
    session = kite.generate_session(request_token, api_secret=api_secret)
    return session["access_token"]
