#!/usr/bin/env python3

import argparse
import os
from typing import Protocol
import mapnik
import flask
from string import Template
import logging
from threading import Lock


l = logging.getLogger(__name__)


WEB_MERCATOR_MIN = -20037508.34
WEB_MERCATOR_MAX = 20037508.34
WEB_MERCATOR_SIZE = 40075016.68


class TileRenderer(Protocol):
    def __init__(self, map_name: str):
        ...

    def render_tile(self, z: int, x: int, y: int) -> bytes | None:
        """Renders a tile if necessary, and returns the tile data.

        Args:
            z (int): Web mercator zoom level.
            x (int): Web mercator tile x coordinate.
            y (int): Web mercator tile y coordinate.

        Returns:
            bytes | None: Binary image data in png format.  Returns None if the tile could not be rendered.
        """
        ...


    def clear_cache(self) -> None:
        """Clears the tile cache."""
        ...    


class MapnikTileRenderer(TileRenderer):
    map_name: str
    tiles_path: str
    stylesheet_template: Template
    base_path: str
    _cached_tile_count: int = 0
    max_cached_tiles: int = 2000

    _lock: Lock

    def __init__(self, xml_template: str, max_cached_tiles: int = 2000):
        self._lock = Lock()
        self.map_name = os.path.splitext(os.path.basename(xml_template))[0]

        cache_dir = '/var/log/jaiabot/cache/mapnik_tiles'
        self.tiles_path = os.path.join(cache_dir, f"{self.map_name}")
        os.makedirs(self.tiles_path, exist_ok=True)

        self._cached_tile_count = sum(1 for _ in os.scandir(self.tiles_path))
        self.base_path = os.path.dirname(xml_template)
        self.max_cached_tiles = max_cached_tiles

        try:
            self.stylesheet_template = Template(open(xml_template).read())
        except FileNotFoundError as e:
            l.warning(f"Failed to load map stylesheet XML template at {xml_template}")
            l.warning(e)
            self.stylesheet_template = None


    def render_tile(self, z: int, x: int, y: int) -> bytes | None:
        output = f"{self.tiles_path}/tile_{z}_{x}_{y}.png"

        with self._lock:
            if os.path.exists(output):
                return open(output, 'rb').read()

            if self.stylesheet_template is None:
                return None

            m = mapnik.Map(256, 256)

            # True makes relative paths resolve from the XML file's directory.
            mapnik.load_map_from_string(m, self.stylesheet_template.substitute(z=z), False, self.base_path)

            tile_side = WEB_MERCATOR_SIZE / (2 ** z)

            tile_bbox = mapnik.Box2d(
                WEB_MERCATOR_MIN + tile_side * x,
                WEB_MERCATOR_MAX - tile_side * y,
                WEB_MERCATOR_MIN + tile_side * (x + 1),
                WEB_MERCATOR_MAX - tile_side * (y + 1),
            )

            m.zoom_to_box(tile_bbox)
            mapnik.render_to_file(m, output, "png", 2.0)

            self._cached_tile_count += 1

            # Remove the oldest (earliest access time) half of the tile cache if we have too many cached tiles.
            if self._cached_tile_count > self.max_cached_tiles:
                tiles = sorted(
                    os.scandir(self.tiles_path), key=lambda entry: entry.stat().st_atime
                )

                tiles_to_remove = len(tiles) // 2

                for tile_index, tile in enumerate(tiles):
                    if tile_index >= tiles_to_remove:
                        break

                    os.remove(tile.path)
                    self._cached_tile_count -= 1

                self._cached_tile_count = len(tiles) - tiles_to_remove

            return open(output, 'rb').read()


    def clear_cache(self) -> None:
        """Clears the tile cache."""
        with self._lock:
            for tile in os.scandir(self.tiles_path):
                os.remove(tile.path)
            self._cached_tile_count = 0


class TileServer:
    app: flask.Flask
    renderer: TileRenderer

    def __init__(self, renderer: TileRenderer):
        self.renderer = renderer
        self.app = flask.Flask(__name__)
        self.app.add_url_rule(
            "/tiles/tile_<int:z>_<int:x>_<int:y>.png",
            view_func=self.serve_tile,
        )
        self.app.add_url_rule("/", view_func=self.index)

    def serve_tile(self, z: int, x: int, y: int) -> flask.Response:
        tile_data = self.renderer.render_tile(z, x, y)
        if tile_data is None:
            return flask.Response("Tile could not be rendered", status=404)
        
        return flask.Response(tile_data, mimetype="image/png")

    def index(self) -> str:
        return flask.send_file("index.html", mimetype="text/html")


    def run(self, **kwargs) -> None:
        self.app.run(**kwargs)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render a Mapnik XML stylesheet to an image."
    )

    parser.add_argument('xml_template', type=str, help='Path to the Mapnik XML template file.')
    parser.add_argument('-c', '--clear-cache', action='store_true', help='Clear the tile cache before starting the server.')
    args = parser.parse_args()

    renderer = MapnikTileRenderer(args.xml_template)
    server = TileServer(renderer)
    if args.clear_cache:
        renderer.clear_cache()
    server.run(host="0.0.0.0", port=8080, threaded=True)


if __name__ == "__main__":
    main()
