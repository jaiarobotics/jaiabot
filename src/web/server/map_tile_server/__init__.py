import os
import glob
from math import *
from dataclasses import *
from shutil import rmtree
import logging
import rasterio
from rasterio.warp import transform
from . import mime_types
from . import geotiff
from .utils import *


logging.basicConfig()
l = logging.getLogger(__name__)


@dataclass
class Rectangle:
    """A rectangle of lat/lon.
    """
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


@dataclass
class Tileset:
    """Tileset metadata
    """
    name: str
    size: int
    tile_count: int

    def json(self):
        return {'name': self.name, 'size': self.size, 'tile_count': self.tile_count}


def lon_lat_to_xy(n_zoom: int, lon_deg: float, lat_deg: float):
    """Convert lon/lat to the corresponding xyz tile coordinates.

    Args:
        n_zoom (int): `2 ** zoom`.
        lon_deg (float): Longitude of point.
        lat_deg (float): Latitude of point.

    Returns:
        tuple[int, int]: x and y tile coordinates as a 2-tuple.
    """
    xtile = int(floor(n_zoom * ((lon_deg + 180) / 360)))
    lat_rad = lat_deg * pi / 180
    ytile = int(floor(n_zoom * (1 - (log(tan(lat_rad) + 1/cos(lat_rad)) / pi)) / 2))
    return xtile, ytile


def tile_xyz_to_bbox_string(zoom: int, x: int, y: int):
    """Convert xyz tile coordinates to a bbox for download NOAA ENC maps.

    Args:
        zoom (int): Zoom level.
        x (int): Tile x coordinate.
        y (int): Tile y coordinate.

    Returns:
        str: The bbox as a comma-delimited string.
    """
    sn = 20037508.34
    we = 20037508.34
    
    n_zoom = 2 ** zoom
    bbox = [
        (x / n_zoom) * 2 * we - we,
        sn - ((y + 1) / n_zoom) * 2 * sn,     
        ((x + 1) / n_zoom) * 2 * we - we,
        sn - (y / n_zoom) * 2 * sn,
    ]

    return '%2C'.join([str(item) for item in bbox])


class MapTileServer:
    """A simple xyz tile server for maps."""
    maps_directory: str
    tiles_directory: str
    geotiffs_directory: str

    def __init__(self, maps_directory: str):
        self.maps_directory = os.path.expanduser(maps_directory)

        self.tiles_directory = self.maps_directory + '/tiles/'
        os.makedirs(self.tiles_directory, exist_ok=True)

        self.geotiffs_directory = self.maps_directory + '/geotiffs/'
        os.makedirs(self.geotiffs_directory, exist_ok=True)

        geotiff.watch_directory_and_convert_to_tiles(self.geotiffs_directory, self.tiles_directory)


    def get_map_names(self):
        """Get a list of offline map layers.

        Returns:
            list[str]: List of offline map layer names.
        """
        map_paths = glob.glob(f'{self.tiles_directory}/*')
        map_paths = filter(lambda path: os.path.isdir(path), map_paths)
        map_paths = map(lambda path: os.path.basename(path), map_paths)
        return list(map_paths)


    def get_maps(self):
        map_paths = glob.glob(f'{self.tiles_directory}/*')
        map_paths = filter(lambda path: os.path.isdir(path), map_paths)

        maps = []
        for map_path in map_paths:
            total_size, tile_count = get_directory_size(map_path)
            map = Tileset(os.path.basename(map_path), total_size, tile_count)
            maps.append(map.json())

        return maps


    def get_tile(self, map_name: str, z: int, x: int, y: int):
        """Get an offline map layer tile.

        Args:
            map_name (str): Name of the map layer.
            z (int): Zoom level.
            x (int): Tile x coordinate.
            y (int): Tile y coordinate.

        Returns:
            bytes or None: Binary image data in png format, if the image exists.
        """
        tile_path = f'{self.tiles_directory}/{map_name}/{z}/{x}/{y}.png'
        if not os.path.isfile(tile_path):
            return None
        else:
            return open(tile_path, 'rb').read()


    def tile_exists(self, map_name:str, z: int, x: int, y: int):
        """Check if a tile exists

        Args:
            map_name (str): Name of the map layer.
            z (int): Zoom level.
            x (int): Tile x coordinate.
            y (int): Tile y coordinate.

        Returns:
            bool: Whether the tile exists.
        """
        tile_path = f'{self.tiles_directory}/{map_name}/{z}/{x}/{y}.png'
        return os.path.isfile(tile_path)


    def put_tile(self, map_name: str, z: int, x: int, y: int, data: bytes):
        """Upload a map tile to an offline map layer.

        Args:
            map_name (str): Name of the map layer.
            z (int): Zoom level.
            x (int): Tile x coordinate.
            y (int): Tile y coordinate.
            data (bytes): Binary image data in png format.
        """
        path = os.path.join(self.tiles_directory, map_name, str(z), str(x))
        os.makedirs(path, exist_ok=True)
        open(f'{path}/{y}.png', 'wb').write(data)


    def delete_map(self, map_name: str):
        """Delete an offline map layer.

        Args:
            map_name (str): Name of the map layer to delete.
        """
        assert(len(map_name) > 0 and len(self.tiles_directory) > 0)
        rmtree(os.path.join(self.tiles_directory, map_name))


    def import_tiles(self, map_name: str, url_template: str, extent: Rectangle, min_zoom=0, max_zoom: int=19, overwrite=False):
        """Import a set of tiles from an online tile server.

        Args:
            map_name (str): Name of the map layer.
            url_template (str): Template string for the url, with `{x}`, `{y}`, `{z}` in place of tile coordinates.
            extent (Rectangle): The area to download tiles.
            min_zoom (int, optional): Minimum zoom level to download. Defaults to 0.
            max_zoom (int, optional): Maximum zoom level to download. Defaults to 19.
            overwrite (bool, optional): Replace existing tiles? Defaults to False.
        """
        import requests
        from http import HTTPStatus

        for zoom in range(min_zoom, max_zoom):
            n = 2 ** zoom
            # max and min are swapped for y, because lat increases northwards, while y decreases
            min_x, max_y = lon_lat_to_xy(n, extent.min_lon, extent.min_lat)
            max_x, min_y = lon_lat_to_xy(n, extent.max_lon, extent.max_lat)

            for x in range(min_x, max_x + 1):
                for y in range(min_y, max_y + 1):
                    if self.tile_exists(map_name, zoom, x, y):
                        continue

                    url = url_template.replace('{x}', str(x)).replace('{y}', str(y)).replace('{zoom}', str(zoom))
                    print(url)
                    response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0'}, timeout=20)
                    if response.status_code != HTTPStatus.OK:
                        print(f'url={url}, status={response.status_code}')
                        continue
                    else:
                        self.put_tile(map_name, zoom, x, y, response.content)


    def import_bbox(self, map_name: str, url_template: str, extent: Rectangle, min_zoom=0, max_zoom: int=19, overwrite=False):
        """Import tiles from e.g. a NOAA ENC server that uses a bbox parameter.

        Args:
            map_name (str): Name of the map layer.
            url_template (str): Template string for the url, with `{bbox}` in place of the bbox.
            extent (Rectangle): The area to download tiles.
            min_zoom (int, optional): Minimum zoom level to download. Defaults to 0.
            max_zoom (int, optional): Maximum zoom level to download. Defaults to 19.
            overwrite (bool, optional): Replace existing tiles? Defaults to False.
        """
        import requests
        from http import HTTPStatus

        for zoom in range(min_zoom, max_zoom):
            n = 2 ** zoom
            # max and min are swapped for y, because lat increases northwards, while y decreases
            min_x, max_y = lon_lat_to_xy(n, extent.min_lon, extent.min_lat)
            max_x, min_y = lon_lat_to_xy(n, extent.max_lon, extent.max_lat)

            for x in range(min_x, max_x + 1):
                for y in range(min_y, max_y + 1):
                    if self.tile_exists(map_name, zoom, x, y):
                        continue

                    bbox_string = tile_xyz_to_bbox_string(zoom, x, y)

                    url = url_template.replace('{bbox}', bbox_string)
                    print(url)
                    response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0'}, timeout=20)
                    if response.status_code != HTTPStatus.OK:
                        print(f'url={url}, status={response.status_code}')
                        continue
                    else:
                        self.put_tile(map_name, zoom, x, y, response.content)


    def start_local_server(self, port=59373):
        import flask
        import json
        from http import HTTPStatus


        app = flask.Flask(__name__)

        @app.route('/maps/', methods=['GET'])
        def get_maps():
            """Get a list of the available map sets.
            """
            return flask.Response(response=json.dumps(self.get_map_names()),
                                status=HTTPStatus.OK,
                                mimetype=mime_types.MIME_TYPE_JSON)


        @app.route('/maps/<map_name>/<z>/<x>/<y>')
        def get_map_tile(map_name: str, z: str, x: str, y: str):
            """Get a map tile
            """
            tile_data = self.get_tile(map_name, int(z), int(x), int(y))

            if tile_data is None:
                return flask.Response(status=HTTPStatus.NOT_FOUND)

            else:
                return flask.Response(tile_data, status=HTTPStatus.OK, mimetype=mime_types.MIME_TYPE_PNG)


        app.run(host='0.0.0.0', port=port, debug=True)


    def put_map_geotiff(self, map_name: str, geotiff_data: bytes):
        os.makedirs(self.geotiffs_directory, exist_ok=True)
        geotiff_path = os.path.join(self.geotiffs_directory, map_name + '.geotiff')
        open(geotiff_path, 'wb').write(geotiff_data)


    def put_map_geotiff_chunk(self, map_name: str, chunk_index: int, geotiff_chunk: bytes):
        """PUT a new chunk of geotiff data to a chunked GeoTIFF file upload.

        Args:
            map_name (str): Destination tileset name
            geotiff_chunk (bytes): Chunk of the GeoTIFF file to append
        """

        partial_geotiff_directory = self.geotiffs_directory + '/partial/'
        os.makedirs(partial_geotiff_directory, exist_ok=True)
        partial_geotiff_path = os.path.join(partial_geotiff_directory, map_name + '.geotiff')


        if len(geotiff_chunk) == 0:
            l.warning(f'GeoTIFF file upload complete: {map_name}')
            complete_geotiff_path = os.path.join(self.geotiffs_directory, map_name + '.geotiff')
            os.rename(partial_geotiff_path, complete_geotiff_path)
            return
        else:
            if chunk_index == 0:
                mode = 'wb' # new file
            else:
                mode = 'ab' # append to file
            l.warning(f'Appending {len(geotiff_chunk)} to {partial_geotiff_path}')
            open(partial_geotiff_path, mode).write(geotiff_chunk)


def test():
    server = MapTileServer('~/maps/')
    data = open('/home/ed/maps/RI_Bristol_353252_1955_24000_geo.tif.geotiff', 'rb').read()
    server.put_map_geotiff('test', data)

