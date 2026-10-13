from pathlib import Path


class RecordNotFound(Exception):
    pass


class InvalidRecordName(Exception):
    pass


class CRUDLRecords:
    """Named JSON records (e.g. exclusion zone sets or mission sets), stored one per file."""

    def __init__(self, root_dir: str | Path):
        self.root_dir = Path(root_dir)


    def _record_path(self, name: str) -> Path:
        """Returns the filesystem path for a named record.

        Raises InvalidRecordName if the name contains characters that could allow
        directory traversal or other path manipulation.
        """
        if not name or '/' in name or '\\' in name or name.startswith('.') or '..' in name:
            raise InvalidRecordName(f"Invalid record name: {name!r}")
        return self.root_dir / f"{name}.json"


    def list(self) -> list[str]:
        """Returns a sorted list of saved record names."""
        self.root_dir.mkdir(parents=True, exist_ok=True)
        return sorted(p.stem for p in self.root_dir.glob("*.json"))


    def get(self, name: str) -> str:
        """Returns the saved record with the given name."""
        path = self._record_path(name)
        if not path.exists():
            raise RecordNotFound(f"Record not found: {name!r}")
        return path.read_text()


    def save(self, name: str, content: str):
        """Saves (or overwrites) a named record."""
        path = self._record_path(name)
        self.root_dir.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


    def delete(self, name: str):
        """Deletes a named record."""
        path = self._record_path(name)
        if not path.exists():
            raise RecordNotFound(f"Record not found: {name!r}")
        path.unlink()
