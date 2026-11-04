#!/usr/bin/env python3

import argparse
import os
from typing import Protocol
import mapnik
import flask
from string import Template


WEB_MERCATOR_MIN = -20037508.34
WEB_MERCATOR_MAX = 20037508.34
WEB_MERCATOR_SIZE = 40075016.68


class TileRenderer(Protocol):
    def __init__(self, map_name: str):
        ...

    def render_tile(self, z: int, x: int, y: int) -> str:
        """Renders a tile if necessary, and returns the path to the tile.

        Args:
            z (int): Web mercator zoom level.
            x (int): Web mercator tile x coordinate.
            y (int): Web mercator tile y coordinate.

        Returns:
            str: Path to the rendered tile.
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

    def __init__(self, xml_template: str, max_cached_tiles: int = 2000):
        self.map_name = os.path.splitext(os.path.basename(xml_template))[0]

        cache_dir = '/var/log/jaiabot/cache/mapnik_tiles'
        self.tiles_path = os.path.join(cache_dir, f"{self.map_name}")
        os.makedirs(self.tiles_path, exist_ok=True)

        self._cached_tile_count = sum(1 for _ in os.scandir(self.tiles_path))
        self.stylesheet_template = Template(open(xml_template).read())
        self.base_path = os.path.dirname(xml_template)
        self.max_cached_tiles = max_cached_tiles

    def render_tile(self, z: int, x: int, y: int) -> str:
        output = f"{self.tiles_path}/tile_{z}_{x}_{y}.png"

        if os.path.exists(output):
            return output

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

        return output


    def clear_cache(self) -> None:
        """Clears the tile cache."""
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
        tile_path = self.renderer.render_tile(z, x, y)
        return flask.send_file(tile_path, mimetype="image/png")

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
