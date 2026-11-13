"""Same project contract, stored in PostgreSQL with user-token RLS enforcement."""

import json

from forma.shared.cloud_auth import CloudUnavailable, cloud_request
from .project_store import MissingProject, ProjectConflict
from .projects import ProjectInput, ProjectPatch, record_from_row


class CloudProjectStore:
    def __init__(self, settings, token, owner_id):
        self.settings, self.token, self.owner_id = settings, token, str(owner_id)

    def request(self, method, **kwargs):
        return cloud_request(self.settings, self.token, method, "/rest/v1/forma_projects", **kwargs)

    def rows(self, response):
        try:
            rows = response.json()
            if not isinstance(rows, list) or any(row.get("owner_id") != self.owner_id for row in rows):
                raise CloudUnavailable
            return rows
        except (ValueError, TypeError, AttributeError):
            raise CloudUnavailable from None

    def filters(self, project_id=None):
        params = {"owner_id": "eq." + self.owner_id, "select": "*"}
        if project_id is not None:
            params["id"] = "eq." + str(project_id)
        return params

    @staticmethod
    def record(row):
        return record_from_row({**row, "payload": json.dumps(row["payload"])})

    def create(self, project: ProjectInput):
        response = self.request("POST", json={"owner_id": self.owner_id, "payload": project.model_dump(mode="json")}, headers={"Prefer": "return=representation"})
        rows = self.rows(response)
        if len(rows) != 1:
            raise CloudUnavailable
        return self.record(rows[0])

    def get(self, project_id):
        rows = self.rows(self.request("GET", params=self.filters(project_id)))
        if not rows:
            raise MissingProject
        return self.record(rows[0])

    def list(self, limit, offset):
        response = self.request("GET", params={**self.filters(), "order": "updated_at.desc,id.asc", "limit": str(limit), "offset": str(offset)}, headers={"Prefer": "count=exact"}, allowed_statuses=(416,))
        try:
            total = int(response.headers["content-range"].split("/")[1])
        except (KeyError, ValueError, IndexError):
            raise CloudUnavailable from None
        if response.status_code == 416:
            if offset < total or total < 0:
                raise CloudUnavailable
            return dict(items=(), total=total, limit=limit, offset=offset)
        return dict(items=tuple(self.record(row) for row in self.rows(response)), total=total, limit=limit, offset=offset)

    def update(self, project_id, patch: ProjectPatch):
        current = self.get(project_id)
        if current.revision != patch.expected_revision or not current.compatible:
            raise ProjectConflict
        data = current.model_dump(mode="json", include=set(ProjectInput.model_fields))
        updated = ProjectInput.model_validate(data | patch.model_dump(mode="json", exclude_unset=True, exclude={"expected_revision"}))
        response = self.request("PATCH", params={**self.filters(project_id), "revision": "eq." + str(patch.expected_revision)},
                                json={"payload": updated.model_dump(mode="json")}, headers={"Prefer": "return=representation"})
        rows = self.rows(response)
        if not rows:
            raise ProjectConflict
        return self.record(rows[0])

    def duplicate(self, project_id):
        current = self.get(project_id)
        if not current.compatible:
            raise ProjectConflict
        data = current.model_dump(mode="json", include=set(ProjectInput.model_fields))
        return self.create(ProjectInput.model_validate(data | {"name": ("Copie — " + current.name)[:120], "status": "draft"}))

    def delete(self, project_id, expected_revision):
        current = self.get(project_id)
        if current.revision != expected_revision:
            raise ProjectConflict
        rows = self.rows(self.request("DELETE", params={**self.filters(project_id), "revision": "eq." + str(expected_revision)}, headers={"Prefer": "return=representation"}))
        if not rows:
            raise ProjectConflict
