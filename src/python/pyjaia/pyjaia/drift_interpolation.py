from typing import *
from dataclasses import *
from scipy.spatial import Delaunay
from turfpy import measurement
from geojson import Point, Feature, LineString
from copy import deepcopy
from pprint import pprint

import numpy as np
import math
import random


def plotDrifts(driftsList: List[List["Drift"]]):
    import plotly.graph_objects as go
    plots = [go.Scatter(x=[drift.location.lon for drift in drifts], y=[drift.location.lat for drift in drifts], mode='markers') for drifts in driftsList]    
    fig = go.Figure(data=plots)
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
    
    def midpoint(self, other: "LatLon"):
        midpointFeature = measurement.midpoint(self.feature(), other.feature())
        return LatLon.fromList(midpointFeature.get('geometry').get('coordinates'))

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
    
    def interpolateToFraction(self, other: "Drift", otherWeight: float):
        lineString = LineString([self.location.list(), other.location.list()])
        lineLength = measurement.length(lineString)
        ourWeight = 1 - otherWeight

        newFeature = measurement.along(lineString, dist=lineLength * otherWeight)
        newLocation = LatLon.fromList(newFeature.get('geometry').get('coordinates'))

        return Drift(
            location=newLocation, 
            speed=ourWeight * self.speed + otherWeight * other.speed,
            heading=fmod(ourWeight * self.heading + otherWeight * other.heading, 0, 360))

def getInterpolatedDrifts(drifts: List[Drift], delta=25):
    # We need at least two points to do any interpolation
    if len(drifts) < 2:
        return deepcopy(drifts)
    
    outputDrifts: List[Drift] = deepcopy(drifts)

    if len(drifts) == 2:
        # Just interpolate along a line
        lineString = LineString([drifts[0].location.list(), drifts[1].location.list()])
        lineLength = measurement.length(lineString, units='m')

        nPoints = math.ceil(lineLength / delta)
        actualDelta = lineLength / nPoints

        for pointIndex in range(1, nPoints):
            outputDrifts.append(drifts[0].interpolateTo(drifts[1], pointIndex * actualDelta, 'm'))

        return outputDrifts
    
    # Get the Delaney triangles
    meshPoints2d = [drift.location.list() for drift in drifts]
    tri = Delaunay(np.array(meshPoints2d), qhull_options="Qbb Qc Qz Q12")

    def div(a: float, b: float):
        if a == 0:
            return 1
        return math.ceil(a / b)

    # Fill triangles with interpolated drifts
    vertexIndices: List[int]

    for vertexIndices in tri.simplices:
        vertexDrifts = [drifts[i] for i in vertexIndices]
        a = vertexDrifts[0].location.distanceTo(vertexDrifts[1].location)
        a1 = vertexDrifts[0].location.distanceTo(vertexDrifts[2].location)
        aDiv = div(min(a, a1), delta)

        for rowIndex in range(1, aDiv):
            # Loop through rows from vertex 0 to vertex 1/2
            startDrift = vertexDrifts[0].interpolateToFraction(vertexDrifts[1], (rowIndex / aDiv))
            endDrift = vertexDrifts[0].interpolateToFraction(vertexDrifts[2], (rowIndex / aDiv))

            b = startDrift.location.distanceTo(endDrift.location)
            bDiv = div(b, delta)

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

    for edge in edges:
        edgeDrifts = [drifts[i] for i in edge]
        d = edgeDrifts[0].location.distanceTo(edgeDrifts[1].location)
        dDiv = div(d, delta)

        for i in range(1, dDiv):
            newDrift = edgeDrifts[0].interpolateToFraction(edgeDrifts[1], i / dDiv)
            outputDrifts.append(newDrift)

    plotDrifts([outputDrifts, drifts])

    return outputDrifts




if __name__ == '__main__':
    drifts = [ Drift(location=LatLon(random.uniform(0, 1), random.uniform(0, 1)), speed=0, heading=1) for i in range(10) ]

    COUNT = 15
    DIST = 5_000

    getInterpolatedDrifts(drifts, DIST)
