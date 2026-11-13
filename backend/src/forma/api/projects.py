"""Projects scoped either to explicit loopback development or verified cloud users."""

from ipaddress import ip_address
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import ValidationError

from forma.domains.furniture.projects import ProjectInput, ProjectPage, ProjectPatch, ProjectRecord


def project_store(request: Request):
    cloud = request.app.state.cloud_settings
    if cloud.enabled:
        from forma.shared.cloud_auth import verified_user
        from forma.domains.furniture.cloud_project_store import CloudProjectStore
        token, owner = verified_user(cloud, request.headers.get("Authorization"))
        return CloudProjectStore(cloud, token, owner)
    # Additional defense for accidentally broad local binds. No forwarding header is trusted.
    try:
        loopback = request.client is not None and ip_address(request.client.host).is_loopback
    except ValueError:
        loopback = False
    local_hosts = {"localhost", "127.0.0.1", "::1"}
    origin = request.headers.get("origin")
    if not loopback or request.url.hostname not in local_hosts or (origin and urlparse(origin).hostname not in local_hosts):
        raise HTTPException(403, "Proiectele locale sunt disponibile doar pe acest calculator.")
    return request.app.state.project_store


router = APIRouter(prefix="/v1/furniture/projects", tags=["projects"])


@router.get("", response_model=ProjectPage)
def list_projects(limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0), store=Depends(project_store)):
    return store.list(limit, offset)


@router.post("", response_model=ProjectRecord, status_code=201)
def create_project(project: ProjectInput, store=Depends(project_store)):
    return store.create(project)


@router.get("/{project_id}", response_model=ProjectRecord)
def get_project(project_id: UUID, store=Depends(project_store)):
    return store.get(project_id)


@router.patch("/{project_id}", response_model=ProjectRecord)
def update_project(project_id: UUID, patch: ProjectPatch, store=Depends(project_store)):
    try:
        return store.update(project_id, patch)
    except ValidationError:
        raise HTTPException(422, "Datele proiectului sunt invalide.") from None


@router.post("/{project_id}/duplicate", response_model=ProjectRecord, status_code=201)
def duplicate_project(project_id: UUID, store=Depends(project_store)):
    return store.duplicate(project_id)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: UUID, expected_revision: int = Query(ge=1), store=Depends(project_store)):
    store.delete(project_id, expected_revision)
    return Response(status_code=204)
