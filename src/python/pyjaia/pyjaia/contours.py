import os
import json
from scipy.spatial import Delaunay
import numpy as np
import cmocean
import logging
from typing import *
from dataclasses import dataclass
from pprint import pprint


@dataclass
class BottomDive:
    lon: float
    lat: float
    depth: float

    def lonLat(self):
        return [self.lon, self.lat]


def getBottomDives(taskPackets: List[Dict]):
    """Filters a list of BottomDive objects from a list of task packet dictionaries.

    Args:
        taskPackets (List[Dict]): A list of task packet dictionaries

    Returns:
        List[BottomDive]: A list of BottomDive objects
    """
    bottomDives: List[BottomDive] = []
    for taskPacket in taskPackets:
        if 'dive' in taskPacket:
            dive = taskPacket['dive']
            if 'bottom_dive' in dive and dive['bottom_dive'] == 1:
                bottomDives.append(BottomDive(dive['start_location']['lon'], dive['start_location']['lat'], dive['depth_achieved']))

    return bottomDives


deepColorMap = cmocean.cm.deep

def colorCode(colorMap, value):
    """Gets an html color code string from the given matplotlib colormap and value

    Args:
        colorMap (ColorMap): A matplotlib ColorMap object
        value (float): Value to read into the color map (0.0-1.0 range)
    """

    rgba = colorMap(value)
    s = f'#{int(rgba[0]*255):02x}{int(rgba[1]*255):02x}{int(rgba[2]*255):02x}'
    return s

def point(coordinates, properties={}):
    return {
        "type": "Feature",
        "properties": properties,
        "geometry": {
            "type": "Point",
            "coordinates": coordinates
        }
    }


def polygon(coordinates, properties={}):
    return {
      "type": "Feature",
      "properties": properties,
      "geometry": {
        "type": "Polygon",
        "coordinates": [ coordinates ] # For some reason, polygons need 3 levels of nesting
      }
    }


def linestring(coordinates, properties={}):
    return {
      "type": "Feature",
      "properties": properties,
      "geometry": {
        "type": "LineString",
        "coordinates": 
            coordinates
      }
    }


def geojson(features):
    return {
        "type": "FeatureCollection",
        'crs': {
            'type': 'name',
            'properties': {
                'name': 'EPSG:4326',
            },
        },
        "features": features
    }


def interpolate(dive0: BottomDive, dive1: BottomDive, depth: float):
    """Returns the lat/lon coordinates of a point on the line between `dive0` and `dive1`, that would interpolate/extrapolate to `depth`.

    Args:
        dive0 (BottomDive): The first dive object.
        dive1 (BottomDive): The second dive object.
        depth (float): The depth interpolate/extrapolate to.

    Returns:
        List[float]: A list of form [lon, lat] indicating the calculated interpolated point location.
    """
    if dive0.depth == dive1.depth:
        fraction = 0
    else:
        fraction = (depth - dive0.depth) / (dive1.depth - dive0.depth)

    return [
        dive0.lon + fraction * (dive1.lon - dive0.lon),
        dive0.lat + fraction * (dive1.lat - dive0.lat)
    ]


def getSimplices(bottomDives: List[BottomDive]):
    """Gets a list of simplices (a tuple of 3 indices) representing the set of Delaunay triangles corresponding to a set of bottom dive coordinates.

    Args:
        bottomDives (List[BottomDive]): A set of bottom dives.

    Returns:
        NDArray[intc]: An array of simplices (a tuple of 3 indices) representing the set of Delaunay triangles corresponding to a set of bottom dive coordinates.
    """
    if len(bottomDives) < 3:
        return []

    meshPoints = [[d.lon, d.lat] for d in bottomDives]

    try:
        tri = Delaunay(np.array(meshPoints), qhull_options="Qbb Qc Qz Q12")
        return tri.simplices
    except Exception as e:
        logging.warning(f'While doing Delaunay triangulation: {e}')
        logging.warning('Do you have co-linear mesh points?')
        return None


def getContourValues(bottomDives: List[BottomDive], contourCount = 10):
    """Gets an array of equally-spaced contour values spanning the rand of depths for a set of `BottomDive` objects.

    Args:
        bottomDives (List[BottomDive]): The input list of `BottomDive` objects.
        contourCount (int, optional): The number of contours to use. Defaults to 10.

    Raises:
        Exception: when all of `bottomDives` have the same depth.

    Returns:
        NDArray[float]: An array of equally-spaced contour values spanning the rand of depths for the `bottomDive` objects.
    """
    # Get contour values
    values = [b.depth for b in bottomDives]
    minValue = min(values)
    maxValue = max(values)

    if minValue == maxValue:
        logging.warning('No contours to display, because all dives reach the same depth')
        raise Exception('No contours to display, because all dives reach the same depth')

    return np.arange(minValue, maxValue + 1e-6, (maxValue - minValue) / contourCount)


def getColorMapPolygons(bottomDives: List[BottomDive], contourValues: List[float]):
    """Gets a list of GeoJSON polygons representing a color contour map for a trio of input `BottomDive` objects.

    Args:
        bottomDives (List[BottomDive]): A list of three input bottom dives.
        contourValues (List[float]): The array of contour values that will correspond to each color in the returned color map.

    Raises:
        Exception: When no revelant contour values span this triangle simplex.

    Returns:
        list[dict]: A list of dictionaries representing GeoJSON for the resulting filled colormap polygons for this simplex.
    """
    # Sort vertex depths by their value
    sortedDives = sorted(bottomDives, key=lambda t: t.depth)
    minDive = sortedDives[0]
    midDive = sortedDives[1]
    maxDive = sortedDives[2]

    # Get min and max contour values in this set (for colorization)
    minContourValue = min(contourValues)
    maxContourValue = max(contourValues)

    # Find which contourValues lie between the min and max
    relevantContourValues: List[float] = []
    for contourIndex in range(1, len(contourValues)):
        if contourValues[contourIndex] >= minDive.depth:
            relevantContourValues.append(contourValues[contourIndex - 1])
            relevantContourValues.append(contourValues[contourIndex])

        if contourValues[contourIndex] > maxDive.depth:
            break

    if len(relevantContourValues) < 2:
        raise Exception('No revelant contour values span this triangle simplex.')

    polygons: List[Dict] = []
    lines: List[Dict] = []

    for contourIndex in range(1, len(relevantContourValues)):
        depth0 = max(relevantContourValues[contourIndex - 1], minDive.depth)
        depth1 = min(relevantContourValues[contourIndex], maxDive.depth)

        pts: List[List[float]] = []

        pts.append(interpolate(minDive, maxDive, depth0))
        pts.append(interpolate(minDive, maxDive, depth1))

        if depth1 > midDive.depth:
            pts.append(interpolate(midDive, maxDive, depth1))
        else:
            pts.append(interpolate(minDive, midDive, depth1))

        if depth0 < midDive.depth and depth1 > midDive.depth:
            pts.append(midDive.lonLat())

        if depth0 > midDive.depth:
            pts.append(interpolate(midDive, maxDive, depth0))
        else:
            pts.append(interpolate(minDive, midDive, depth0))

        pts.append(interpolate(minDive, maxDive, depth0))

        colorParameter = (depth1 - minContourValue) / (maxContourValue - minContourValue)

        polygons.append(polygon(pts, {'value': depth1, 'fill': colorCode(deepColorMap, colorParameter), 'stroke-width': 0}))

        if depth0 != minDive.depth:
            lines.append(linestring([pts[0], pts[-2]], {'value': depth0, 'stroke': 'black'}))

    return polygons + lines


def taskPacketsToColorMap(taskPackets: List[Dict]):
    """Gets a GeoJSON dictionary representing a depth color map for the bottom dives contained in an input set of task packets.

    Args:
        taskPackets (list[Dict]): A list of dictionaries representing `TaskPacket` objects.

    Returns:
        dict[str, any]: A GeoJSON dictionary representing a depth color map for the bottom dives contained in `taskPackets`.
    """
    bottomDives = getBottomDives(taskPackets)

    simplices = getSimplices(bottomDives)
    contourValues = getContourValues(bottomDives)

    polygons: List[Dict] = []

    for simplex in simplices:
        polygons.extend(getColorMapPolygons([bottomDives[i] for i in simplex], contourValues))

    return geojson(polygons)


if __name__ == '__main__':
    taskPackets = [
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 10}, 'depth_achieved': 1}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 10, 'lat': 15}, 'depth_achieved': 5}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 15, 'lat': 10}, 'depth_achieved': 4}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 15, 'lat': 15}, 'depth_achieved': 2}},
        {'dive': {'bottom_dive': 1, 'start_location': {'lon': 20, 'lat': 15}, 'depth_achieved': 16}},
    ]

    json.dump(taskPacketsToColorMap(taskPackets), open(os.path.expanduser('~/test.json'), 'w'))

