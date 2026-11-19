#!/usr/bin/env python3
"""Build fast-rendering land and coastline layers from Natural Earth's ne_10m_land.shp.

ne_10m_land.shp stores each continent as one polygon, so every tile that touches a
continent has to read and clip the whole outline. This writes zoom-specific layers
whose polygons are small enough that a tile only reads the pieces it overlaps:

  land_low    polygons simplified to 0.1 deg, for zoom 0-2 (filled and outlined)
  land_mid    polygons simplified to 0.01 deg and split, for zoom 3-5 (fill only)
  coast_mid   outlines of land_mid, cut into short lines
  land_high   full-resolution polygons, split, for zoom 6+ (fill only)
  coast_high  full-resolution outlines, cut into short lines

The coastlines are separate line layers so the split edges are never outlined.

Requires the GDAL Python bindings (apt install python3-gdal).

Usage: split_land_layers.py <dir with ne_10m_land.shp> <output dir>
"""

import argparse
import os
import time

from osgeo import ogr

ogr.UseExceptions()

MAX_POINTS = 1000


def polygons(geometry):
    kind = ogr.GT_Flatten(geometry.GetGeometryType())
    if kind == ogr.wkbPolygon:
        return [geometry.Clone()]
    if kind in (ogr.wkbMultiPolygon, ogr.wkbGeometryCollection):
        return [p for i in range(geometry.GetGeometryCount()) for p in polygons(geometry.GetGeometryRef(i))]
    return []


def point_count(geometry):
    if geometry.GetGeometryCount() == 0:
        return geometry.GetPointCount()
    return sum(point_count(geometry.GetGeometryRef(i)) for i in range(geometry.GetGeometryCount()))


def box(min_x, max_x, min_y, max_y):
    ring = ogr.Geometry(ogr.wkbLinearRing)
    for x, y in ((min_x, min_y), (max_x, min_y), (max_x, max_y), (min_x, max_y), (min_x, min_y)):
        ring.AddPoint_2D(x, y)
    polygon = ogr.Geometry(ogr.wkbPolygon)
    polygon.AddGeometry(ring)
    return polygon


def simplify(polygon, tolerance):
    simplified = polygon.SimplifyPreserveTopology(tolerance)
    return polygons(simplified if simplified.IsValid() else simplified.MakeValid())


def add_feature(layer, geometry):
    feature = ogr.Feature(layer.GetLayerDefn())
    feature.SetGeometry(geometry)
    layer.CreateFeature(feature)


def write_split_polygon(layer, polygon, overlap):
    """Halve the polygon along its longer side until each piece has at most MAX_POINTS points.

    Neighbouring pieces overlap by `overlap` degrees; without it, anti-aliasing draws
    a faint seam where two pieces meet.
    """
    if polygon.IsEmpty():
        return

    min_x, max_x, min_y, max_y = polygon.GetEnvelope()
    if point_count(polygon) <= MAX_POINTS or max(max_x - min_x, max_y - min_y) < 4 * overlap:
        add_feature(layer, polygon)
        return

    half_overlap = overlap / 2
    if max_x - min_x >= max_y - min_y:
        mid = (min_x + max_x) / 2
        halves = (box(min_x, mid + half_overlap, min_y, max_y), box(mid - half_overlap, max_x, min_y, max_y))
    else:
        mid = (min_y + max_y) / 2
        halves = (box(min_x, max_x, min_y, mid + half_overlap), box(min_x, max_x, mid - half_overlap, max_y))

    for half in halves:
        for piece in polygons(polygon.Intersection(half)):
            write_split_polygon(layer, piece, overlap)


def write_outline(layer, polygon):
    """Write each ring of the polygon as lines of at most MAX_POINTS points."""
    for i in range(polygon.GetGeometryCount()):
        points = polygon.GetGeometryRef(i).GetPoints()
        for start in range(0, len(points) - 1, MAX_POINTS - 1):
            line = ogr.Geometry(ogr.wkbLineString)
            for x, y, *_ in points[start:start + MAX_POINTS]:
                line.AddPoint_2D(x, y)
            if line.GetPointCount() >= 2:
                add_feature(layer, line)


class ShapefileWriter:
    def __init__(self, out_dir, srs):
        self.out_dir = out_dir
        self.srs = srs
        self.driver = ogr.GetDriverByName("ESRI Shapefile")

    def create(self, name, geometry_type):
        path = os.path.join(self.out_dir, name + ".shp")
        if os.path.exists(path):
            self.driver.DeleteDataSource(path)
        data_source = self.driver.CreateDataSource(path)
        return data_source, data_source.CreateLayer(name, self.srs, geometry_type)


def total_area(polygon_list):
    return sum(p.GetArea() for p in polygon_list)


def shapefile_area(path):
    data_source = ogr.Open(path)
    return sum(f.GetGeometryRef().GetArea() for f in data_source.GetLayer())


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source_dir", help="Directory containing ne_10m_land.shp")
    parser.add_argument("out_dir", help="Directory to write the new layers to")
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    started = time.time()

    source = ogr.Open(os.path.join(args.source_dir, "ne_10m_land.shp"))
    source_layer = source.GetLayer()
    writer = ShapefileWriter(args.out_dir, source_layer.GetSpatialRef())

    land = []
    for feature in source_layer:
        geometry = feature.GetGeometryRef()
        land += polygons(geometry if geometry.IsValid() else geometry.MakeValid())

    data_source, layer = writer.create("land_low", ogr.wkbPolygon)
    for polygon in land:
        for simplified in simplify(polygon, 0.1):
            add_feature(layer, simplified)
    data_source = None

    # The overlaps are about 1.5 px at the lowest zoom each layer is drawn at (zoom 3 and zoom 6).
    land_mid = [s for polygon in land for s in simplify(polygon, 0.01)]
    data_source, layer = writer.create("land_mid", ogr.wkbPolygon)
    for polygon in land_mid:
        write_split_polygon(layer, polygon, 0.25)
    data_source = None

    data_source, layer = writer.create("coast_mid", ogr.wkbLineString)
    for polygon in land_mid:
        write_outline(layer, polygon)
    data_source = None

    data_source, layer = writer.create("land_high", ogr.wkbPolygon)
    for polygon in land:
        write_split_polygon(layer, polygon, 0.03)
    data_source = None

    data_source, layer = writer.create("coast_high", ogr.wkbLineString)
    for polygon in land:
        write_outline(layer, polygon)
    data_source = None

    print(f"Wrote layers to {args.out_dir} in {time.time() - started:.0f} s")
    print(f"Land area (sq deg): source {total_area(land):.1f}, "
          f"land_low {shapefile_area(os.path.join(args.out_dir, 'land_low.shp')):.1f}, "
          f"land_mid {total_area(land_mid):.1f} before split")


if __name__ == "__main__":
    main()
