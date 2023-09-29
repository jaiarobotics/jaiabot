from typing import *
from dataclasses import *
from scipy.spatial import Delaunay
from turfpy import measurement
from geojson import Point, Feature, LineString
from copy import deepcopy
from pprint import pprint

import numpy as np
import logging
import math
import timeit


def plotDrifts(drifts: List["Drift"]):
    import plotly.express as px
    fig = px.scatter(x=[drift.location.lon for drift in drifts], y=[drift.location.lat for drift in drifts])
    fig.show()


def fmod(x: float, min: float, max: float):
    delta = max - min
    n = (x - min) / delta

    if n > 1 or n < 0:
        return min + (n - math.floor(n)) * delta
    else:
        return x

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


@dataclass
class Drift:
    location: LatLon
    speed: float = 0.0
    heading: float = 0.0

    def interpolateTo(self, other: "Drift", distance: float, units: str='km'):
        lineString = LineString([self.location.list(), other.location.list()])
        lineLength = measurement.length(lineString, units=units)
        otherWeight = distance / lineLength
        ourWeight = 1 - otherWeight

        newFeature = measurement.along(lineString, dist=distance, unit=units)
        newLocation = LatLon.fromList(newFeature.get('geometry').get('coordinates'))

        newDrift = Drift(
            location=newLocation, 
            speed=ourWeight * self.speed + otherWeight * other.speed,
            heading=fmod(ourWeight * self.heading + otherWeight * other.heading, 0, 360))
        
        return newDrift


def getInterpolatedDrifts(drifts: List[Drift], delta=10):
    # We need at least two points to do any interpolation
    if len(drifts) < 2:
        return drifts
    
    drifts = deepcopy(drifts)

    if len(drifts) == 2:
        # Just interpolate along a line
        lineString = LineString([drifts[0].location.list(), drifts[1].location.list()])
        lineLength = measurement.length(lineString, units='m')

        nPoints = math.ceil(lineLength / delta)
        actualDelta = lineLength / nPoints

        for pointIndex in range(1, nPoints):
            drifts.append(drifts[0].interpolateTo(drifts[1], pointIndex * actualDelta, 'm'))

        return drifts
    
    # Recursively interpolate using Delaney triangulations, until there are no distances longer than delta
    MAX_ITER = 6
    MAX_POINTS = 200

    for iteration in range(MAX_ITER):

        plotDrifts(drifts)

        if len(drifts) > MAX_POINTS:
            logging.warning(f'Maximum drift points exceeded: {len(drifts)} > {MAX_POINTS}')
            return drifts


        # Get the Delaney triangles
        meshPoints2d = [drift.location.list() for drift in drifts]
        tri = Delaunay(np.array(meshPoints2d), qhull_options="Qbb Qc Qz Q12")

        tesselated = False # Did we need to add a new drift this cycle?

        # Dictionary of edges
        connections: Set[Tuple[int]] = set()

        for simplex in tri.simplices:
            # Simplex contains the three drift indices of the mesh points to interpolate between
            for indexPair in [[0, 1], [0, 2], [1, 2]]:
                index0 = simplex[indexPair[0]]
                index1 = simplex[indexPair[1]]

                connections.add((min(index0, index1), max(index0, index1)))

        for indexPair in connections:
            drift0 = drifts[indexPair[0]]
            drift1 = drifts[indexPair[1]]

            distance = drift0.location.distanceTo(drift1.location)

            if distance > delta:
                newDrift = drift0.interpolateTo(drift1, distance / 2, 'm')
                drifts.append(newDrift)

                tesselated = True

        if not tesselated:
            return drifts

    logging.warning(f'Maximum iterations exceeded: {iteration} >= {MAX_ITER}')
    return drifts




if __name__ == '__main__':
    drifts = [
        Drift(LatLon(-72, 41.2), 0, 0),
        Drift(LatLon(-73, 40.8), 1, -1),
        Drift(LatLon(-72, 42.3), 2, -2),
        Drift(LatLon(-71, 41.5), 4, 23)
    ]

    timeit.timeit()

    COUNT = 15
    DIST = 20_000

    getInterpolatedDrifts(drifts, DIST)
