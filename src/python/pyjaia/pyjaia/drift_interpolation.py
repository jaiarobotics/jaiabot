from typing import *
from dataclasses import *
from turfpy import measurement
from copy import deepcopy
from pprint import pprint
from geojson import Point, Feature, LineString, FeatureCollection

import numpy as np
import scipy.spatial
import math
import random
import geojson
import logging

logger = logging.getLogger('drift_interpolation')
logger.setLevel(logging.INFO)


def plotDrifts(driftsList: List[List["Drift"]]):
    """Use plotly to show the interpolated drift points.  Only used for debugging purposes.

    Args:
        driftsList (List[List[Drift]]): A list containing lists of Drifts to plot on separate plots.
    """
    import plotly.graph_objects as go
    plots = [go.Scatter(x=[drift.location.lon for drift in drifts], y=[drift.location.lat for drift in drifts], mode='markers') for drifts in driftsList]    
    fig = go.Figure(data=plots)
    fig.show()


def fmod(x: float, min: float, max: float):
    """Returns a float modulus of x within the range [min, max].  In other words, if x is between min and max, it returns x.
    Otherwise, it wraps x back into the [min, max] range.

    Args:
        x (float): The input value.
        min (float): Minimum of the range to wrap within.
        max (float): Maximum of the range to wrap within.

    Returns:
        float: The input value, wrapped within the [min, max] range.

    Examples:
        `fmod(2.3, 2, 3) == 2.3`

        `fmod(1.6, 2.0, 4.0) == 3.6`

        `fmod(3.05, -1, 3) == -0.95`
    """
    delta = max - min
    n = (x - min) / delta

    if n > 1 or n < 0:
        return min + (n - math.floor(n)) * delta
    else:
        return x


def clamp(value: float, minimum: float, maximum: float):
    """Clamps the input value between a minimum and maximum value

    Args:
        value (float): Input value to clamp
        minimum (float): Minimum allowable value to return
        maximum (float): Maximum allowable value to return

    Returns:
        float: The clamped value, equivalent to `min(maximum, max(minimum, value))`
    """

    return min(maximum, max(minimum, value))


@dataclass
class LatLon:
    lat: float
    lon: float

    @staticmethod
    def fromList(l: List[float]):
        return LatLon(lat=l[1], lon=l[0])

    def list(self):
        return [self.lon, self.lat]
    
    def feature(self):
        return Feature(geometry=Point([self.lon, self.lat]))

    def distanceTo(self, other: "LatLon") -> float:
        return measurement.distance(self.feature(), other.feature(), units='m')
    
    def midpoint(self, other: "LatLon"):
        midpointFeature = measurement.midpoint(self.feature(), other.feature())
        return LatLon.fromList(midpointFeature.get('geometry').get('coordinates'))
    
    def rhumb_destination(self, distance: float, bearing: float):
        x = measurement.rhumb_destination(Point([self.lon, self.lat]), distance, bearing, {'units': 'm'})
        return LatLon.fromList(x.get('geometry').get('coordinates'))
    

@dataclass
class Drift:
    location: LatLon
    speed: float = 0.0
    heading: float = 0.0

    def interpolateTo(self, other: "Drift", distance: float, units: str='km'):
        """Interpolate between this Drift and another drift, a certain distance toward the other drift

        Args:
            other (Drift): The destination drift to interpolate toward
            distance (float): Distance along the rhumb line to the destination drift
            units (str, optional): Units of the distance. Defaults to 'km'.

        Returns:
            Drift: The interpolated drift
        """

        lineString = LineString([self.location.list(), other.location.list()])
        lineLength = measurement.length(lineString, units=units)
        otherWeight = distance / lineLength
        return self.interpolateToFraction(other, otherWeight)

    def interpolateToFraction(self, other: "Drift", otherWeight: float):
        """Interpolate between self and another Drift object by a certain fraction

        Args:
            other (Drift): The other drift object
            otherWeight (float): Linear fraction the other drift object interpolate to

        Returns:
            Drift: A drift object that's interpolated between self andthe other drift object
        """
        lineString = LineString([self.location.list(), other.location.list()])
        lineLength = measurement.length(lineString)
        ourWeight = 1 - otherWeight

        newFeature = measurement.along(lineString, dist=lineLength * otherWeight)
        newLocation = LatLon.fromList(newFeature.get('geometry').get('coordinates'))

        return Drift(
            location=newLocation, 
            speed=ourWeight * self.speed + otherWeight * other.speed,
            heading=fmod(ourWeight * (self.heading or 0.0) + otherWeight * (other.heading or 0.0), 0, 360))


def getDelaunayTriangulation(locations: List[LatLon]):
    """Gets a Delaunay triangulation of a set of locations

    Args:
        locations (List[LatLon]): A list of locations of the points to triangulate.

    Raises:
        Exception: When a valid Delaunay triangulation could not be constructed, even after random joggling.

    Returns:
        scipy.spatial.Delaunay: A Delaunay triangulation object for the mesh.
    """

    JOGGLE_DEGREES = 1e-6
    MAX_RETRIES = 1

    meshPoints2d = [location.list() for location in locations]
    tryNumber = 1
    
    while True:
        try:
            tri = scipy.spatial.Delaunay(np.array(meshPoints2d), qhull_options="Qbb Qc Qz Q12")
            return tri
        except scipy.spatial._qhull.QhullError as e:
            # This can happen in the case of duplicate points, colinear points, etc.
            #   We can retry with joggled points.
            if tryNumber > MAX_RETRIES:
                # Too many tries, give up
                raise e
            
            # Joggle the inputs by 1e-6 degrees
            for pt in meshPoints2d:
                pt[0] += random.uniform(-JOGGLE_DEGREES, JOGGLE_DEGREES)
                pt[1] += random.uniform(-JOGGLE_DEGREES, JOGGLE_DEGREES)

        tryNumber += 1


def getInterpolatedDrifts(drifts: List[Drift], resolutionDistance: float=50):
    """Interpolates between a list of input drifts, with a specified minimum resolution distance.

    Args:
        drifts (list[Drift]): The list of drifts to interpolate between.
        resolutionDistance (float, optional): The target resolution distance between the resulting interpolated drift locations (in meters). Defaults to 50 meters.

    Returns:
        list[Drift]: The resulting list of interpolated drifts, including the original set of drifts.
    """

    MAX_INTERPOLATION_POINTS = 5

    # We need at least two points to do any interpolation
    if len(drifts) < 2:
        return deepcopy(drifts)
    
    outputDrifts: List[Drift] = deepcopy(drifts)

    if len(drifts) == 2:
        # If we only have two points, then just interpolate along a line
        lineString = LineString([drifts[0].location.list(), drifts[1].location.list()])
        lineLength = measurement.length(lineString, units='m')

        # We need at least 1 point, or we get division by zero
        nPoints = clamp(math.ceil(lineLength / resolutionDistance), 1, MAX_INTERPOLATION_POINTS)
        actualDelta = lineLength / nPoints

        for pointIndex in range(1, nPoints):
            outputDrifts.append(drifts[0].interpolateTo(drifts[1], pointIndex * actualDelta, 'm'))

        return outputDrifts
    
    # If we have a network of 3 or more points, then we calculate a set of 
    #   Delauney triangles to use as our mesh to interpolate between
    try:
        tri = getDelaunayTriangulation([drift.location for drift in drifts])
    except Exception as e:
        logging.warning(f'Could not generate Delaunay triangulation')
        logging.warning(e.with_traceback)
        # If unsuccessful, we'll log a warning and just return the original points
        return outputDrifts

    # Fill triangles with interpolated drifts
    vertexIndices: List[int]

    logger.debug('Calculating interpolated drifts')
    logger.debug(f'  simplex count: {len(tri.simplices)}')

    for vertexIndices in tri.simplices:
        vertexDrifts = [drifts[i] for i in vertexIndices]
        a = vertexDrifts[0].location.distanceTo(vertexDrifts[1].location)
        a1 = vertexDrifts[0].location.distanceTo(vertexDrifts[2].location)
        aDiv = clamp(math.ceil(min(a, a1) / resolutionDistance), 1, MAX_INTERPOLATION_POINTS)

        for rowIndex in range(1, aDiv):
            # Loop through rows from vertex 0 to vertex 1/2
            startDrift = vertexDrifts[0].interpolateToFraction(vertexDrifts[1], (rowIndex / aDiv))
            endDrift = vertexDrifts[0].interpolateToFraction(vertexDrifts[2], (rowIndex / aDiv))

            b = startDrift.location.distanceTo(endDrift.location)
            bDiv = clamp(math.ceil(b / resolutionDistance), 1, MAX_INTERPOLATION_POINTS)

            for ptIndex in range(1, bDiv):
                newDrift = startDrift.interpolateToFraction(endDrift, ptIndex / bDiv)

                outputDrifts.append(newDrift)

    # Interpolate the edges too
    def getEdges(simplices: List[Tuple[int]]):
        edges: Set[Tuple[int]] = set([])
        for verts in simplices:
            edges.add((verts[0], verts[1]))
            edges.add((verts[0], verts[2]))
            edges.add((verts[1], verts[2]))

        return edges

    edges = getEdges(tri.simplices)

    logger.debug(f'  num edges: {len(edges)}')

    for edge in edges:
        edgeDrifts = [drifts[i] for i in edge]
        d = edgeDrifts[0].location.distanceTo(edgeDrifts[1].location)
        dDiv = clamp(math.ceil(d / resolutionDistance), 1, MAX_INTERPOLATION_POINTS)

        for i in range(1, dDiv):
            newDrift = edgeDrifts[0].interpolateToFraction(edgeDrifts[1], i / dDiv)
            outputDrifts.append(newDrift)

    # For debugging interpolation
    # plotDrifts([outputDrifts, drifts])

    return outputDrifts


def taskPacketsToDrifts(taskPackets: List[Dict]):
    """Gets a list of Drift objects from a list of TaskPacket dictionaries

    Args:
        taskPackets (list[Dict]): A list of input TaskPacket dictionaries.

    Returns:
        list[Drift]: A list of Drift objects from the input task packets, if any are present, (otherwise an empty list)
    """
    drifts: List[Drift] = []

    for taskPacket in taskPackets:
        drift = taskPacket.get('drift', None)

        if drift is not None:
            location = drift['start_location']
            location = LatLon(lat=location['lat'], lon=location['lon'])
            
            estimated_drift = drift.get('estimated_drift', None)
            if estimated_drift is not None:
                speed = estimated_drift.get('speed', 0.0)
                heading = estimated_drift.get('heading', 0.0)
                drift = Drift(
                    location=location, speed=speed, heading=heading
                )
                drifts.append(drift)

    return drifts


def driftsToGeoJSON(drifts: List[Drift]):
    """Produces a GeoJSON string representing an input list of Drift objects

    Args:
        drifts (List[Drift]): The input list of Drift objects to process.

    Returns:
        str: A GeoJSON string representing the input drifts.
    """
    features = []
    for drift in drifts:
        # as points
        properties = {
            'type': 'drift',
            'speed': drift.speed,
            'heading': drift.heading
        }
        features.append(Feature(geometry=Point(drift.location.list()), properties=properties))

        # as lines
        # properties = {
        #     'type': 'drift',
        #     'speed': drift.speed,
        #     'heading': drift.heading
        # }
        # start = drift.location
        # end = start.rhumb_destination(drift.speed * 100, drift.heading)
        # features.append(Feature(geometry=LineString([start.list(), end.list()]), properties=properties))

    return geojson.dumps(FeatureCollection(features=features))


def taskPacketsToDriftMarkersGeoJSON(taskPackets: List[Dict]):
    """Produces a GeoJSON string representing the drifts and interpolated drifts from an input list of TaskPacket dictionaries

    Args:
        taskPackets (List[Dict]): A list of TaskPacket dictionaries to process into GeoJSON.

    Returns:
        str: A GeoJSON string representing the drifts and interpolated drifts present in the input list of TaskPacket dictionaries.
    """
    drifts = taskPacketsToDrifts(taskPackets)
    interpolatedDrifts = getInterpolatedDrifts(drifts)
    return driftsToGeoJSON(interpolatedDrifts)


if __name__ == '__main__':
    # Test triangulation of duplicate locations
    drifts = [
        Drift(location=LatLon(lat=43.01, lon=-76), speed=1, heading=3),
        Drift(location=LatLon(lat=43, lon=-76), speed=1, heading=2),
        Drift(location=LatLon(lat=43, lon=-76), speed=1, heading=2),
        Drift(location=LatLon(lat=43, lon=-76), speed=1, heading=2),
        Drift(location=LatLon(lat=43, lon=-76), speed=1, heading=2),
        Drift(location=LatLon(lat=43, lon=-76), speed=1, heading=2)
    ]

    pprint(getInterpolatedDrifts(drifts))
