import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

try:
    import psycopg
except ImportError:  # pragma: no cover - raised with a clear message when PostgreSQL storage is used.
    psycopg = None


_WRITE_LOCK = threading.RLock()
_INITIALIZATION_LOCK = threading.RLock()
_POSTGRES_READY = False

BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data"
DOCUMENTS_TABLE = "vinyl_documents"


def _database_url() -> str:
    return os.getenv("DATABASE_URL", "").strip()


def _is_application_data_path(path: str) -> bool:
    try:
        return Path(path).resolve().parent == DATA_DIR.resolve()
    except OSError:
        return False


def _require_postgres_driver() -> None:
    if psycopg is None:
        raise RuntimeError(
            "PostgreSQL storage requires psycopg. Install backend requirements before starting the server."
        )


def _connect():
    _require_postgres_driver()
    database_url = _database_url()
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for PostgreSQL storage.")
    try:
        return psycopg.connect(database_url, connect_timeout=5)
    except psycopg.Error as error:
        raise RuntimeError("PostgreSQL storage is unavailable. Check DATABASE_URL and the database server.") from error


def _read_file(path: Path, fallback: Any) -> Any:
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return fallback


def _write_file(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = ""
    try:
        descriptor, temp_path = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp_path, path)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def _ensure_postgres_ready() -> None:
    global _POSTGRES_READY
    if _POSTGRES_READY:
        return

    with _INITIALIZATION_LOCK:
        if _POSTGRES_READY:
            return
        with _connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {DOCUMENTS_TABLE} (
                    document_key TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            connection.commit()
        _migrate_legacy_json_documents()
        _POSTGRES_READY = True


def _migrate_legacy_json_documents() -> None:
    """Seed PostgreSQL once from the existing JSON data without overwriting live rows."""
    if not DATA_DIR.exists():
        return

    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(f"SELECT document_key FROM {DOCUMENTS_TABLE}")
        existing_keys = {row[0] for row in cursor.fetchall()}
        for json_path in DATA_DIR.glob("*.json"):
            if json_path.name in existing_keys:
                continue
            payload = _read_file(json_path, None)
            if payload is None:
                continue
            cursor.execute(
                f"""
                INSERT INTO {DOCUMENTS_TABLE} (document_key, payload)
                VALUES (%s, %s::jsonb)
                ON CONFLICT (document_key) DO NOTHING
                """,
                (json_path.name, json.dumps(payload, ensure_ascii=False)),
            )
        connection.commit()


def initialize_storage() -> None:
    """Initialize the PostgreSQL table and import legacy JSON data on first startup."""
    if not _database_url():
        raise RuntimeError("DATABASE_URL is required. This app stores production data in PostgreSQL.")
    _ensure_postgres_ready()


def _read_postgres_document(path: str, fallback: Any) -> Any:
    _ensure_postgres_ready()
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(
            f"SELECT payload FROM {DOCUMENTS_TABLE} WHERE document_key = %s",
            (Path(path).name,),
        )
        row = cursor.fetchone()
    return fallback if row is None else row[0]


def _write_postgres_document(path: str, payload: Any) -> None:
    _ensure_postgres_ready()
    serialized_payload = json.dumps(payload, ensure_ascii=False)
    with _connect() as connection, connection.cursor() as cursor:
        cursor.execute(
            f"""
            INSERT INTO {DOCUMENTS_TABLE} (document_key, payload)
            VALUES (%s, %s::jsonb)
            ON CONFLICT (document_key) DO UPDATE
            SET payload = EXCLUDED.payload, updated_at = NOW()
            """,
            (Path(path).name, serialized_payload),
        )
        connection.commit()


def read_json(path: str, fallback: Any) -> Any:
    if _is_application_data_path(path):
        return _read_postgres_document(path, fallback)
    return _read_file(Path(path), fallback)


def write_json(path: str, payload: Any) -> None:
    with _WRITE_LOCK:
        if _is_application_data_path(path):
            _write_postgres_document(path, payload)
            return
        _write_file(Path(path), payload)
