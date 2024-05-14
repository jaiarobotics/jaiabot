import os
import json
import logging

# Class to manage the GeoTIFF and other images used to display Custom Overlays

class GeoTiffs:
    def __init__(self, directory):
        self.directory = directory

    def put(self):
        # Placeholder for the put method
        raise NotImplementedError("The 'put' method is not yet implemented.")

    # Return a list of images that have associated metadata
    def list(self):
        supported_image_extensions = ('.tif', '.tiff', '.png', '.jpg', '.jpeg')

        if not os.path.isdir(self.directory):
            return []

        valid_images = []
        for filename in os.listdir(self.directory):
            if filename.lower().endswith(supported_image_extensions):
                md_json_filename = filename + '.meta.json'
                md_json_path = os.path.join(self.directory, md_json_filename)
                if os.path.exists(md_json_path):
                    try:
                        with open(md_json_path, 'r') as file:
                            metadata = json.load(file)
                    except Exception as e:
                        error = f'Error reading GeoTiff metadata for {filename}: {e}'
                        logging.debug(error)
                        metadata = {
                          'error': error
                        }
                    metadata['filename'] = filename
                    valid_images.append(metadata)
        return valid_images