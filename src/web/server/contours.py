import os
import json
from scipy.spatial import Delaunay
import numpy as np


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

    # Find which contourValues lie between the min and max
    relevantContourValues = filter(lambda val: minValue <= val < maxValue, contourValues)

    contourSegments = []

    for contourValue in relevantContourValues:
        pt0 = interpolate(sortedVertices[0], sortedVertices[2], contourValue)

        if contourValue > midValue:
            pt1 = interpolate(sortedVertices[1], sortedVertices[2], contourValue)
        else:
            pt1 = interpolate(sortedVertices[0], sortedVertices[1], contourValue)

        contourSegments.append({
            'vertices': [pt0, pt1],
            'value': contourValue
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

    tri = Delaunay(np.array(meshPoints2d))

    # Get contour values
    values = [p[2] for p in meshPoints]
    minValue = min(values)
    maxValue = max(values)
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

    linestrings = [linestring(contourSegment['vertices'], properties={'name': str(contourSegment['value'])}) for contourSegment in contourSegments]

    return geojson(linestrings)


if __name__ == '__main__':
    meshPoints = [
        [10, 10, 1],
        [15, 15, 2],
        [15, 10, 2],
        [10, 15, 1],
        [20, 20, 3],
        [20, 10, 3],
    ]


    json.dump(getContourGeoJSON(meshPoints), open(os.path.expanduser('~/test.json'), 'w'))
