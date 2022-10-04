import os
import json
from scipy.spatial import Delaunay
import numpy as np


def point(coordinates, name=''):
    return {
        "type": "Feature",
        "properties": {
            "name": name
        },
        "geometry": {
            "type": "Point",
            "coordinates": coordinates
        }
    }


def polygon(coordinates, name=''):
    return {
      "type": "Feature",
      "properties": {
        "name": name
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [
            coordinates
        ]
      }
    }


def linestring(coordinates, name=''):
    return {
      "type": "Feature",
      "properties": {
        "name": name
      },
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

    # Return a list of line segment coordinates, like so:
    # [ 
    #     [ [0, 0], [0, 1] ],
    #     [ [1, 2], [3, 4] ],
    #     [ [8, 7], [6, 5] ]
    # ]

    return contourSegments


def getContourSegmentsForMeshPoints(meshPoints):
    meshPoints2d = [p[:2] for p in meshPoints]

    tri = Delaunay(np.array(meshPoints2d))

    contourValues = np.arange(1, 4, 0.3)

    contourSegments = []

    for simplex in tri.simplices:
        triangleVertices = [meshPoints[i] for i in simplex]
        contourSegments += getContourSegmentsForTriangles(triangleVertices, contourValues)

    return contourSegments


if __name__ == '__main__':
    meshPoints = [
        [10, 10, 1],
        [15, 15, 2],
        [15, 10, 2],
        [10, 15, 1],
        [20, 20, 3],
        [20, 10, 3],
    ]

    contourSegments = getContourSegmentsForMeshPoints(meshPoints)

    linestrings = [linestring(contourSegment['vertices'], name=str(contourSegment['value'])) for contourSegment in contourSegments]

    data = geojson(linestrings)

    json.dump(data, open(os.path.expanduser('~/test.json'), 'w'))
