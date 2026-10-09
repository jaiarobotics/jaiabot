from pathlib import Path


class CRUDLRecords:
    ROOT_DIR: Path = None

    def __init__(self, root_dir: str | Path):
        self.ROOT_DIR = Path(root_dir)


    def _item_path(self, name: str) -> Path:
        """Returns the filesystem path for a named exclusion zone set.

        Raises ValueError if the name contains characters that could allow
        directory traversal or other path manipulation.
        """
        if not name or '/' in name or '\\' in name or name.startswith('.') or '..' in name:
            raise ValueError(f"Invalid zone set name: {name!r}")
        return self.ROOT_DIR / f"{name}.json"


    def list_zones(self) -> list[str]:
        """Returns a sorted list of saved exclusion zone set names."""
        self.ROOT_DIR.mkdir(parents=True, exist_ok=True)
        return sorted(p.stem for p in self.ROOT_DIR.glob("*.json"))


    def get_zone(self, name: str) -> str:
        """Returns the saved exclusion zone set with the given name."""
        path = self._item_path(name)
        if not path.exists():
            raise Exception(f"Zone set not found: {name!r}")
        return path.read_text()


    def save_zone(self, name: str, content: str):
        """Saves (or overwrites) a named exclusion zone set."""
        path = self._item_path(name)
        self.ROOT_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


    def delete_zone(self, name: str):
        """Deletes a named exclusion zone set."""
        path = self._item_path(name)
        if not path.exists():
            raise Exception(f"Zone set not found: {name!r}")
        path.unlink()

