import logging
import rasterio
import rasterio.warp
import rasterio.io
from copy import deepcopy
import numpy as np
import os
import time
from math import *


logging.basicConfig(level=logging.INFO)
l = logging.getLogger(__name__)


web_mercator: rasterio.crs.CRS = rasterio.crs.CRS.from_epsg(3857)
web_mercator_size = 20037508.34


def _web_mercator_to_tilexyz(web_mercator_x: float, web_mercator_y: float, zoom: int):
    n_zoom = int(2 ** zoom)
    tile_size = web_mercator_size * 2 / n_zoom
    x = int((web_mercator_x + web_mercator_size) // tile_size)
    y = int((-web_mercator_y + web_mercator_size) // tile_size)
    return (zoom, x, y)


def _tilexyz_transform(tile_xyz: tuple[int, int, int], pixel_size: int=256) -> rasterio.Affine:
    zoom, x, y = tile_xyz
    n_zoom = int(2 ** zoom)
    tile_size = web_mercator_size * 2 / n_zoom
    west = x * tile_size       - web_mercator_size
    north = web_mercator_size  - y * tile_size

    return rasterio.Affine.translation(west, north) * \
           rasterio.Affine.scale(tile_size / pixel_size, -tile_size / pixel_size)


def scale_band(input_data: np.ndarray, nodata_value) -> np.ndarray:
    """Returns a numpy array that is scaled to the 0-255 range for PNG image output.

    Args:
        input_data (np.ndarray): Array of band data
        nodata_value (_type_): _description_

    Returns:
        np.ndarray: _description_
    """
    filtered_input_data = input_data[input_data != nodata_value]
    min_value = np.min(filtered_input_data)
    max_value = np.max(filtered_input_data)
    if max_value == min_value:
        # Let's dodge divide by zero
        max_value = min_value + 1

    scale_coefficient = 255.0 / (max_value - min_value)

    # copy and replace nodata with min_value
    data = input_data.copy()
    data[data == nodata_value] = min_value

    return (data - min_value) * scale_coefficient


def extract_tiles(geotiff_path: str, tileset_path: str, zoom_levels=None, tile_size=256):
    """Extracts a tileset of png files from a GeoTIFF.

    Args:
        geotiff_path (str): Path to input GeoTIFF file.
        tileset_path (str): Path to directory to extract the tile PNG files.
        zoom_levels (Iterable[int], optional): Iterable of zoom levels to extract. Defaults to range(0, 18).
        tile_size (int, optional): Pixel dimensions of each square tile. Defaults to 256.
    """
    # Refer to https://rasterio.readthedocs.io/en/stable/topics/reading.html

    try:
        geotiff_file = rasterio.open(geotiff_path)

        web_mercator_bounds = rasterio.warp.transform_bounds(geotiff_file.crs, web_mercator, *geotiff_file.bounds, densify_pts=0)

        # If zoom_levels is None, then we want to calculate a max zoom level based on the resolution of the GeoTIFF
        if zoom_levels is None:
            pixels_per_equator_meter = geotiff_file.width / abs(web_mercator_bounds[2] - web_mercator_bounds[0])
            max_zoom_tile_fraction = tile_size / pixels_per_equator_meter / (web_mercator_size * 2)
            max_zoom_level = int(ceil(-log(max_zoom_tile_fraction) / log(2.0)))
            max_zoom_level = min(20, max(0, max_zoom_level))
            zoom_levels = range(max_zoom_level + 1)
            l.warning(f'{geotiff_path=} {max_zoom_level=}')

        meta: dict = deepcopy(geotiff_file.meta)
        src_data: np.ndarray = geotiff_file.read()
        geotiff_transform: rasterio.Affine = geotiff_file.transform
        geotiff_crs: rasterio.crs.CRS = geotiff_file.crs

        # For each zoom level
        for zoom in zoom_levels:
            n_zoom = int(2 ** zoom)
            # Get the x and y tile ranges
            _, min_x, min_y = _web_mercator_to_tilexyz(web_mercator_bounds[0], web_mercator_bounds[3], zoom)
            _, max_x, max_y = _web_mercator_to_tilexyz(web_mercator_bounds[2], web_mercator_bounds[1], zoom)

            # Iterate through the tiles, wrapping around longitude if necessary
            if max_x < min_x:
                max_x += n_zoom

            for raw_x in range(min_x, max_x + 1):
                x = raw_x % n_zoom
                os.makedirs(f'{tileset_path}/{zoom}/{x}/', exist_ok=True)

                for y in range(min_y, max_y + 1):
                    tile_path = f'{tileset_path}/{zoom}/{x}/{y}.png'
                    l.debug(tile_path)
                    if os.path.exists(tile_path):
                        continue

                    tile_transform = _tilexyz_transform((zoom, x, y))

                    meta.update({
                        'driver': 'PNG',
                        'dtype': 'uint8',
                        'transform': tile_transform,
                        'height': tile_size,
                        'width': tile_size
                    })

                    if not os.path.exists(tileset_path):
                        # This tileset may have been deleted
                        return

                    tile_file = rasterio.open(tile_path, 'w', **meta)

                    band: np.ndarray
                    for i, band in enumerate(src_data, 1):

                        if band.dtype == 'float32':
                            # If this is a float band, we want to scale it to the 0-255 range for the PNG image
                            band = scale_band(band, nodata_value=meta.get('nodata'))

                        dest = np.zeros([tile_size, tile_size])

                        rasterio.warp.reproject(
                            band,
                            dest,
                            src_transform=geotiff_transform,
                            src_crs=geotiff_crs,
                            dst_transform=tile_transform,
                            dst_crs=web_mercator,
                            resampling=rasterio.warp.Resampling.nearest)

                        tile_file.write(dest, indexes=i)

                    tile_file.close()
    
    except Exception as e:
        print(e)
        print(f'Tileset {tileset_path} possible deleted?  Aborting extraction.')
        return


    l.warning('Extraction complete')


def watch_directory_and_convert_to_tiles(geotiff_path: str, tiles_path: str):
    """Starts a thread to watch a directory and convert geotiff files to tilesets

    Args:
        geotiff_path (str): Path where to look for input geotiff files
        tiles_path (str): Where to write the tileset output pngs (e.g. <tiles_path>/0/0/0/.png)
    """
    import threading
    import glob

    completed_path = geotiff_path + '/completed/'
    os.makedirs(completed_path, exist_ok=True)

    def watch_function():
        while True:
            geotiff_files = glob.glob(geotiff_path + '/*.geotiff') + glob.glob(geotiff_path + '/*.tiff') + glob.glob(geotiff_path + '/*.tif')
            for geotiff_file in geotiff_files:
                l.warning(f'Extracting {geotiff_file} to tileset')
                extract_tiles(geotiff_file, tiles_path + '/' + os.path.basename(geotiff_file))
                os.makedirs(completed_path, exist_ok=True)
                os.replace(geotiff_file, completed_path + os.path.basename(geotiff_file))
            
            time.sleep(2)

    
    threading.Thread(target=watch_function).start()


def info(geotiff_path: str):
    print(geotiff_path)
    with rasterio.open(geotiff_path) as geotiff_file:
        print(f'meta: {geotiff_file.meta}')
    print()


def print_range(geotiff_path: str):
    print(geotiff_path)
    with rasterio.open(geotiff_path) as geotiff_file:
        src_data: np.ndarray = geotiff_file.read()
        nodata_value = geotiff_file.meta.get('nodata', None)

        for i, band in enumerate(src_data, 1):
            filtered_band = band[band != nodata_value]
            print(f'BAND {i} range: {np.min(filtered_band)} - {np.max(filtered_band)}')

    print()


if __name__ == '__main__':
    import sys
    import os.path

    command = sys.argv[1]

    if command == 'add':
        geotiff_path, maps_path = sys.argv[2:4]
        tileset_path = os.path.join(maps_path, 'tiles', os.path.basename(geotiff_path))

        print(f'Extracting {geotiff_path} -> {tileset_path}')
        extract_tiles(geotiff_path, tileset_path)
        print('Done extraction.')
    elif command == 'info':
        geotiff_paths = sys.argv[2:]
        for geotiff_path in geotiff_paths:
            info(geotiff_path)
    elif command == 'range':
        geotiff_path = sys.argv[2]
        print_range(geotiff_path)
    else:
        l.error(f'Unknown command: {command}')
        exit(1)

