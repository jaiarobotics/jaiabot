import os
import json
from scipy.spatial import Delaunay
import numpy as np
import cmocean
import logging

deepColorMap = cmocean.cm.deep

def colorCode(colorMap, value):
    """Gets an html color code string from the given matplotlib colormap and value

    Args:
        colorMap (ColorMap): A matplotlib ColorMap object
        value (float): Value to read into the color map (0.0-1.0 range)
    """

    rgba = colorMap(value)
    s = f'#{int(rgba[0]*255):02x}{int(rgba[1]*255):02x}{int(rgba[2]*255):02x}{int(rgba[3]*255):02x}'
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
        "coordinates": [
            coordinates
        ]
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


def interpolate(pt0, pt1, value):
    if pt0[2] == pt1[2]:
        fraction = 0
    else:
        fraction = (value - pt0[2]) / (pt1[2] - pt0[2])

    return [
        pt0[0] + fraction * (pt1[0] - pt0[0]),
        pt0[1] + fraction * (pt1[1] - pt0[1])
    ]


def getContourSegmentsForTriangles(triangleVertices, contourValues):
    # Sort traingles by their value
    sortedVertices = sorted(triangleVertices, key=lambda t: t[2])
    minValue = sortedVertices[0][2]
    midValue = sortedVertices[1][2]
    maxValue = sortedVertices[2][2]

    # Get min and max contour values in this set (for colorization)
    minContourValue = min(contourValues)
    maxContourValue = max(contourValues)

    # Find which contourValues lie between the min and max
    relevantContourValues = filter(lambda val: minValue <= val < maxValue, contourValues)

    contourSegments = []

    for contourValue in relevantContourValues:
        pt0 = interpolate(sortedVertices[0], sortedVertices[2], contourValue)

        if contourValue > midValue:
            pt1 = interpolate(sortedVertices[1], sortedVertices[2], contourValue)
        else:
            pt1 = interpolate(sortedVertices[0], sortedVertices[1], contourValue)

        colorParameter = (contourValue - minContourValue) / (maxContourValue - minContourValue)

        contourSegments.append({
            'vertices': [pt0, pt1],
            'value': contourValue,
            'color': colorCode(deepColorMap, colorParameter)
        })

    return contourSegments


def getContourSegmentsForMeshPoints(meshPoints, contourCount=10):
    """Gets an array of contour line segments, given a set of irregular mesh points (x, y, z)

    Args:
        meshPoints (iterable): A container with triplets (x, y, z), with z used to produce the contour segments.
        contourCount (int): The number of contours to produce

    Returns:
        list: A list of dictionaries like so: { 'vertices': [[0, 1], [1, 2]], 'value': 0.4 }
    """
    if len(meshPoints) < 3:
        return []

    meshPoints2d = [p[:2] for p in meshPoints]

    try:
        tri = Delaunay(np.array(meshPoints2d), qhull_options="Qbb Qc Qz Q12")
    except Exception as e:
        logging.warning(f'While doing Delaunay triangulation: {e}')
        logging.warning('Do you have co-linear mesh points?')
        return []

    # Get contour values
    values = [p[2] for p in meshPoints]
    minValue = min(values)
    maxValue = max(values)

    if minValue == maxValue:
        logging.warning('No contours to display, because all dives reach the same depth')
        return []

    contourValues = np.arange(minValue, maxValue, (maxValue - minValue) / contourCount)

    contourSegments = []

    for simplex in tri.simplices:
        triangleVertices = [meshPoints[i] for i in simplex]
        contourSegments += getContourSegmentsForTriangles(triangleVertices, contourValues)

    return contourSegments

def getContourGeoJSON(meshPoints, contourCount=10):
    """Return a GeoJSON string containing contours for a set of mesh points

    Args:
        meshPoints (iterable): A container with triplets (x, y, z), with z used to produce the contour segments.
        contourCount (int): The number of contours to produce

    Returns:
        dict: a GeoJSON dictionary
    """
    contourSegments = getContourSegmentsForMeshPoints(meshPoints)

    linestrings = [linestring(contourSegment['vertices'], properties={'name': str(contourSegment['value']), 'color': contourSegment['color']}) for contourSegment in contourSegments]

    return geojson(linestrings)


def taskPacketsToContours(taskPackets):
    """Return a GeoJSON containing contours for a set of task packets

    Args:
        taskPackets (iterable): An iterable of task packets as represented by dicts

    Returns:
        dict: a GeoJSON dictionary
    """
    meshPoints = []
    for taskPacket in taskPackets:
        if 'dive' in taskPacket:
            dive = taskPacket['dive']
            if 'bottom_dive' in dive and dive['bottom_dive'] == 1:
                meshPoints.append([dive['start_location']['lon'], dive['start_location']['lat'], dive['depth_achieved']])

    return getContourGeoJSON(meshPoints)


if __name__ == '__main__':
    meshPoints = [
        [10, 10, 1],
        [15, 15, 2],
        [20, 10, 2],
        [17, 10, 2]
    ]

    json.dump(getContourGeoJSON(meshPoints), open(os.path.expanduser('~/test.json'), 'w'))

