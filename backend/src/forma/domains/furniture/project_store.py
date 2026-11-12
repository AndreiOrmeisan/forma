"""Furniture input store with transactional, numbered SQLite migrations."""

import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from forma.domains.furniture.projects import ProjectInput, ProjectPatch, record_from_row


class MissingProject(Exception):
    pass


class ProjectConflict(Exception):
    pass


class ProjectStore:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def transaction(self):
        connection = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        connection.row_factory = sqlite3.Row
        try:
            connection.execute("BEGIN IMMEDIATE")
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.transaction() as connection:
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version > 1:
                raise RuntimeError("Unsupported project database schema version.")
            if version == 0:
                connection.execute("CREATE TABLE projects (id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1)")
                connection.execute("CREATE INDEX projects_updated ON projects(updated_at DESC, id ASC)")
                connection.execute("PRAGMA user_version = 1")

    @staticmethod
    def find(connection, project_id):
        row = connection.execute("SELECT * FROM projects WHERE id = ?", (str(project_id),)).fetchone()
        if row is None:
            raise MissingProject
        return row

    def create(self, project: ProjectInput):
        with self.transaction() as connection:
            return self.insert(connection, project)

    @staticmethod
    def insert(connection, project: ProjectInput):
        # Windows clock resolution may give consecutive writes identical timestamps.
        latest = connection.execute("SELECT MAX(updated_at) FROM projects").fetchone()[0]
        instant = datetime.now(UTC)
        if latest:
            instant = max(instant, datetime.fromisoformat(latest) + timedelta(microseconds=1))
        project_id, now = str(uuid4()), instant.isoformat(timespec="microseconds")
        connection.execute("INSERT INTO projects(id,payload,created_at,updated_at) VALUES (?,?,?,?)",
                           (project_id, project.model_dump_json(), now, now))
        return record_from_row(ProjectStore.find(connection, project_id))

    def get(self, project_id):
        with self.transaction() as connection:
            return record_from_row(self.find(connection, project_id))

    def list(self, limit, offset):
        with self.transaction() as connection:
            total = connection.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
            rows = connection.execute("SELECT * FROM projects ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?", (limit, offset)).fetchall()
            return dict(items=tuple(record_from_row(row) for row in rows), total=total, limit=limit, offset=offset)

    def update(self, project_id, patch: ProjectPatch):
        with self.transaction() as connection:
            row = self.find(connection, project_id)
            current = record_from_row(row)
            if row["revision"] != patch.expected_revision or not current.compatible:
                raise ProjectConflict
            import json
            updated = ProjectInput.model_validate(json.loads(row["payload"]) | patch.model_dump(exclude_unset=True, exclude={"expected_revision"}))
            now = max(datetime.now(UTC), current.updated_at + timedelta(microseconds=1)).isoformat(timespec="microseconds")
            connection.execute("UPDATE projects SET payload=?, updated_at=?, revision=revision+1 WHERE id=?",
                               (updated.model_dump_json(), now, str(project_id)))
            return record_from_row(self.find(connection, project_id))

    def duplicate(self, project_id):
        with self.transaction() as connection:
            current = record_from_row(self.find(connection, project_id))
            if not current.compatible:
                raise ProjectConflict
            data = current.model_dump(include=set(ProjectInput.model_fields))
            data.update(name=("Copie — " + current.name)[:120], status="draft")
            return self.insert(connection, ProjectInput.model_validate(data))

    def delete(self, project_id, expected_revision):
        with self.transaction() as connection:
            row = self.find(connection, project_id)
            if row["revision"] != expected_revision:
                raise ProjectConflict
            connection.execute("DELETE FROM projects WHERE id=?", (str(project_id),))
