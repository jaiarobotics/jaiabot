import geojson
import geojson.utils
import random
from math import *


class Annotations:
    """Contains the user-added annotations"""

    featureCollection = geojson.FeatureCollection([])
    """A GeoJSON FeatureCollection of annotation features."""
    version = floor(random.uniform(0, 1 << 16))
    """Current version number of the annotations collection."""


    def __init__(self) -> None:
        pass


    def generateRandomPoints(self):
        """Generates a set of random point features for testing.
        """
        for i in range(1000):
            geometry = geojson.utils.generate_random('Point')
            properties = {
                'type': 'annotation',
                'title': f'Test Title {i}',
                'description': f'Test description {i}',
                'marker-size': random.choice(['small', 'medium', 'large']), # small medium large
                'marker-color': f'#{floor(random.uniform(0, 1 << 24)):06x}',
                'data': {
                    'fribulosity': 6.3,
                    'cromulence': 8.2
                }
            }

            feature = geojson.Feature(i, geometry, properties)

            self.featureCollection['features'].append(feature)


    def dumps(self):
        """Get the GeoJSON as a string.

        Returns:
            str: The GeoJSON representing the annotation FeatureCollection
        """
        return geojson.dumps(self.featureCollection)
    
    def appendFeature(self, newFeature: geojson.Feature):
        """Append a new annotation.

        Args:
            newFeature (geojson.Feature): The new annotation feature.
        """
        self.featureCollection['features'].append(newFeature)
        self.version += 1

    def clearFeatures(self):
        """Clears the annotations.
        """
        self.featureCollection['features'] = []
        self.version += 1
