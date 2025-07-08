import os
import glob
from math import *
from dataclasses import *
from mime_types import *


@dataclass
class Rectangle:
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


def lon_lat_to_xy(n_zoom: int, lon_deg: float, lat_deg: float):
    xtile = int(floor(n_zoom * ((lon_deg + 180) / 360)))
    lat_rad = lat_deg * pi / 180
    ytile = int(floor(n_zoom * (1 - (log(tan(lat_rad) + 1/cos(lat_rad)) / pi)) / 2))
    return xtile, ytile


def tile_xyz_to_bbox_string(zoom: int, x: int, y: int):
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
    maps_directory: str

    def __init__(self, maps_directory: str):
        self.maps_directory = os.path.expanduser(maps_directory)


    def get_map_names(self):
        map_paths = glob.glob(f'{self.maps_directory}/*')
        map_paths = filter(lambda path: os.path.isdir(path), map_paths)
        map_paths = map(lambda path: os.path.basename(path), map_paths)
        return list(map_paths)


    def get_tile(self, map_name: str, z: int, x: int, y: int):
        tile_path = f'{self.maps_directory}/{map_name}/{z}/{x}/{y}.png'
        if not os.path.isfile(tile_path):
            return None
        else:
            return open(tile_path, 'rb').read()


    def tile_exists(self, map_name:str, z: int, x: int, y: int):
        tile_path = f'{self.maps_directory}/{map_name}/{z}/{x}/{y}.png'
        return os.path.isfile(tile_path)


    def put_tile(self, map_name: str, z: int, x: int, y: int, data: bytes):
        path = os.path.join(self.maps_directory, map_name, str(z), str(x))
        os.makedirs(path, exist_ok=True)
        open(f'{path}/{y}.png', 'wb').write(data)


    def import_tiles(self, map_name: str, url_template: str, extent: Rectangle, min_zoom=0, max_zoom: int=19, overwrite=False):
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
            return flask.Response(response=json.dumps(map_tile_server.get_map_names()),
                                status=HTTPStatus.OK,
                                mimetype=MIME_TYPE_JSON)


        @app.route('/maps/<map_name>/<z>/<x>/<y>')
        def get_map_tile(map_name: str, z: str, x: str, y: str):
            """Get a map tile
            """
            tile_data = map_tile_server.get_tile(map_name, int(z), int(x), int(y))

            if tile_data is None:
                return flask.Response(status=HTTPStatus.NOT_FOUND)

            else:
                return flask.Response(tile_data, status=HTTPStatus.OK, mimetype=MIME_TYPE_PNG)


        app.run(host='0.0.0.0', port=port, debug=True)


if __name__ == '__main__':
    import sys

    map_tile_server = MapTileServer(os.path.expanduser(sys.argv[1]))
    lat = 41.6627684
    lon = -71.273214

    delta = 0.01
    extent = Rectangle(min_lat=lat - delta, max_lat=lat + delta, min_lon=lon - delta, max_lon=lon + delta)
    # map_tile_server.import_tiles('osm', 'https://tile.openstreetmap.org/{zoom}/{x}/{y}.png', extent, max_zoom=19)

    # https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer/export?
    # F=image&
    # FORMAT=PNG32&
    # TRANSPARENT=true&
    # SIZE=512%2C512&
    # BBOX=-10018754.171394622, 5009377.085697312, -5009377.085697311, 10018754.171394624&
    # BBOXSR=3857&
    # IMAGESR=3857&
    # DPI=180
    # BBOX=-15028131.257091932, 0, -12523442.714243276, 2504688.5428486555

    map_tile_server.import_bbox('noaa', 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer/export?F=image&FORMAT=PNG32&TRANSPARENT=true&SIZE=512%2C512&BBOX={bbox}&BBOXSR=3857&IMAGESR=3857&DPI=180', extent, max_zoom=19)
    map_tile_server.start_local_server()
