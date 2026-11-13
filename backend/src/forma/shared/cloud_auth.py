"""Verified Supabase identity and user-scoped HTTP, without administrative keys."""

from uuid import UUID
import httpx

from forma.config import CloudSettings


class CloudUnavailable(Exception):
    pass


class CloudUnauthorized(Exception):
    pass


def cloud_request(settings: CloudSettings, token: str, method: str, path: str, **kwargs) -> httpx.Response:
    allowed_statuses = kwargs.pop("allowed_statuses", ())
    try:
        response = httpx.request(method, settings.url + path, timeout=15, follow_redirects=False,
                                headers={"apikey": settings.public_key, "Authorization": "Bearer " + token,
                                         "Content-Type": "application/json", **kwargs.pop("headers", {})}, **kwargs)
    except httpx.HTTPError:
        raise CloudUnavailable from None
    if response.status_code in (401, 403):
        raise CloudUnauthorized
    if response.status_code >= 300 and response.status_code not in allowed_statuses:
        raise CloudUnavailable
    return response


def verified_user(settings: CloudSettings, authorization: str | None) -> tuple[str, UUID]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise CloudUnauthorized
    token = authorization[7:].strip()
    if not token or len(token) > 16000:
        raise CloudUnauthorized
    # getUser validates token authenticity/expiry at the Auth service. Never decode a
    # client JWT or trust a submitted owner_id as the identity source.
    response = cloud_request(settings, token, "GET", "/auth/v1/user")
    try:
        return token, UUID(response.json()["id"])
    except (KeyError, ValueError, TypeError):
        raise CloudUnauthorized from None
