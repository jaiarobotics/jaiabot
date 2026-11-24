#!/usr/bin/env python3

import argparse
import os
from typing import Protocol
import mapnik
import flask
from string import Template
import logging
import tempfile
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
    template_params: dict[str, str]
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

        # Clear cache, in case there's been an update to the stylesheet
        self.clear_cache()

        self._cached_tile_count = len(self._cached_tiles())
        self.base_path = os.path.dirname(xml_template)
        self.max_cached_tiles = max_cached_tiles

        try:
            self.stylesheet_template = Template(open(xml_template).read())
        except FileNotFoundError as e:
            l.warning(f"Failed to load map stylesheet XML template at {xml_template}")
            l.warning(e)
            self.stylesheet_template = None

        self.template_params = {
            'water_color': '#78B5D9',
            'land_color': '#A6C875',
            'urban_color': '#D4CD91',
            'label_size': '8',
            'label_adjustment': '-2',
        }


    def render_tile(self, z: int, x: int, y: int) -> bytes | None:
        # Validate tile coordinates
        if z < 0 or z > 19 or x < 0 or y < 0 or x >= 1 << z or y >= 1 << z:
            return None

        output = f"{self.tiles_path}/tile_{z}_{x}_{y}.png"

        # Return from cache if available
        try:
            with open(output, 'rb') as tile:
                return tile.read()
        except FileNotFoundError:
            pass

        tile_data = self._render_tile(z, x, y, output)

        # Remove old cache entries
        self.evict_cache()

        return tile_data


    def _render_tile(self, z: int, x: int, y: int, output_path: str) -> bytes | None:
        """Render a single map tile at the given zoom level and coordinates, saving it to the specified output path.

        Args:
            z (int): Zoom level.
            x (int): Tile x-coordinate.
            y (int): Tile y-coordinate.
            output_path (str): Path to save the rendered tile.

        Returns:
            bytes | None: The rendered tile data as bytes, or None if rendering failed.
        """

        if self.stylesheet_template is None:
            return None

        NUM_TILES = 1 << z

        # Tile size and padding in pixels
        TILE_SIZE_PIXELS = 256
        TILE_VERTICAL_PADDING_PIXELS = 64
        TILE_LEFT_PADDING_PIXELS = 64 if x > 0 else 0
        TILE_RIGHT_PADDING_PIXELS = 64 if x < (1 << z) - 1 else 0

        m = mapnik.Map(TILE_SIZE_PIXELS + TILE_LEFT_PADDING_PIXELS + TILE_RIGHT_PADDING_PIXELS, 
                       TILE_SIZE_PIXELS + 2 * TILE_VERTICAL_PADDING_PIXELS)
        self.template_params['z'] = z
        mapnik.load_map_from_string(m, self.stylesheet_template.substitute(self.template_params), False, self.base_path)

        # Tile size and padding in geographical coordinates
        tile_side = WEB_MERCATOR_SIZE / NUM_TILES
        vertical_padding = tile_side * TILE_VERTICAL_PADDING_PIXELS / TILE_SIZE_PIXELS
        left_padding = tile_side * TILE_LEFT_PADDING_PIXELS / TILE_SIZE_PIXELS
        right_padding = tile_side * TILE_RIGHT_PADDING_PIXELS / TILE_SIZE_PIXELS

        tile_left   = WEB_MERCATOR_MIN + tile_side * x       - left_padding
        tile_top    = WEB_MERCATOR_MAX - tile_side * y       + vertical_padding
        tile_right  = WEB_MERCATOR_MIN + tile_side * (x + 1) + right_padding
        tile_bottom = WEB_MERCATOR_MAX - tile_side * (y + 1) - vertical_padding

        tile_bbox = mapnik.Box2d(
            max(tile_left, WEB_MERCATOR_MIN),
            min(tile_top, WEB_MERCATOR_MAX),
            min(tile_right, WEB_MERCATOR_MAX),
            max(tile_bottom, WEB_MERCATOR_MIN),
        )

        m.zoom_to_box(tile_bbox)

        image = mapnik.Image(m.width, m.height)
        mapnik.render(m, image, 2.0)

        # Crop the image to the final tile size
        cropped = image.view(TILE_LEFT_PADDING_PIXELS, TILE_VERTICAL_PADDING_PIXELS, TILE_SIZE_PIXELS, TILE_SIZE_PIXELS)
        tile_data = cropped.to_string("png32")

        # Rename into place so a concurrent request never reads a partly written tile.
        fd, staging_path = tempfile.mkstemp(dir=self.tiles_path, suffix=".tmp")
        with os.fdopen(fd, 'wb') as staging:
            staging.write(tile_data)
        os.replace(staging_path, output_path)

        return tile_data


    def evict_cache(self):
        """Evict tiles from the cache if the cache exceeds the maximum allowed number of cached tiles."""

        with self._lock:
            self._cached_tile_count += 1

            # Remove the oldest (earliest access time) half of the tile cache if we have too many cached tiles.
            if self._cached_tile_count > self.max_cached_tiles:
                tiles = sorted(self._cached_tiles(), key=lambda entry: entry.stat().st_atime)
                tiles_to_remove = len(tiles) // 2

                for tile in tiles[:tiles_to_remove]:
                    os.remove(tile.path)

                self._cached_tile_count = len(tiles) - tiles_to_remove


    def _cached_tiles(self) -> list[os.DirEntry]:
        return [entry for entry in os.scandir(self.tiles_path) if entry.name.endswith(".png")]


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
        return "<p>Tile URL: <code>/tiles/tile_{z}_{x}_{y}.png</code></p>"        


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
