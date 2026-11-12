"""Local-only project endpoints; never mounted in the public application."""

from ipaddress import ip_address
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import ValidationError

from forma.domains.furniture.projects import ProjectInput, ProjectPage, ProjectPatch, ProjectRecord
from forma.domains.furniture.project_store import ProjectStore


def local_store(request: Request) -> ProjectStore:
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


router = APIRouter(prefix="/v1/furniture/projects", tags=["local projects"], dependencies=[Depends(local_store)])


@router.get("", response_model=ProjectPage)
def list_projects(request: Request, limit: int = Query(20, ge=1, le=50), offset: int = Query(0, ge=0)):
    return request.app.state.project_store.list(limit, offset)


@router.post("", response_model=ProjectRecord, status_code=201)
def create_project(project: ProjectInput, request: Request):
    return request.app.state.project_store.create(project)


@router.get("/{project_id}", response_model=ProjectRecord)
def get_project(project_id: UUID, request: Request):
    return request.app.state.project_store.get(project_id)


@router.patch("/{project_id}", response_model=ProjectRecord)
def update_project(project_id: UUID, patch: ProjectPatch, request: Request):
    try:
        return request.app.state.project_store.update(project_id, patch)
    except ValidationError:
        raise HTTPException(422, "Datele proiectului sunt invalide.") from None


@router.post("/{project_id}/duplicate", response_model=ProjectRecord, status_code=201)
def duplicate_project(project_id: UUID, request: Request):
    return request.app.state.project_store.duplicate(project_id)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: UUID, request: Request, expected_revision: int = Query(ge=1)):
    request.app.state.project_store.delete(project_id, expected_revision)
    return Response(status_code=204)
