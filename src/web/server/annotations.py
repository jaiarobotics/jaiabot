import geojson
import geojson.utils


features = [geojson.utils.generate_random('Point') for i in range(10)]


class Annotations:
    featureCollection = geojson.FeatureCollection(features)
    """A GeoJSON FeatureCollection of annotation features."""
    version = 0
    """Current version number of the annotations collection."""


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
