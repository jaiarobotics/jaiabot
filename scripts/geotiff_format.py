#!/usr/bin/env python3

# Script to format the JSON produced by gdalinfo by extracting the
# data needed to display the image as a Custom Overlay layer in
# the Jaia Command and Control webpage.

import json
import sys
import os

def extract_data(json_data):
    # Remove the extension from the description, and preserve it as a separate attribute
    extension = ''
    description = json_data.get('description', '')
    if '.' in description or '/' in description:
        basename = os.path.basename(description)
        description, extension = os.path.splitext(basename)

    # Define the structure of the output based on the required fields
    extracted_data = {
        'description': description,
        'extension': extension,
        'proj4': json_data.get('coordinateSystem', {}).get('proj4', ''),
    }


    if extracted_data['proj4'] != '':
        needsGeoreference = False
    else:
        needsGeoreference = True

    isTiff = (json_data.get('driverLongName', '') == 'GeoTIFF')

    if needsGeoreference or not isTiff:
        needsGeoreference = True
        extracted_data['cornerCoordinates'] = {
            'lowerLeft': [0,0],
            'upperRight': [0,0],
        }

    if needsGeoreference:
        sys.stderr.write('Warning: the image does not have georeferences - please add\n')
        sys.stderr.write('- the projection and cornerCoordinates to the .meta.json file.\n\n')

    # Extracting band information if present
    if isTiff and 'bands' in json_data:
        isRGB = False
        json_bands = json_data['bands']
        colors = [band['colorInterpretation'].lower() for band in json_bands]
        if len(json_bands) == 3 and colors == ['red', 'green', 'blue']:
            isRGB = True
        elif len(json_bands) == 1 and colors == ['palette']:
            isRGB = True
            json_bands = [
                {
                    'band': 1,
                    'colorInterpretation': 'Red',
                    'noDataValue': None
                },
                {
                    'band': 2,
                    'colorInterpretation': 'Green',
                    'noDataValue': None
                },
                {
                    'band': 3,
                    'colorInterpretation': 'Blue',
                    'noDataValue': None
                }
            ]
        bands = []
        for band in json_bands:
            extracted_band = {
                'band': band.get('band', '')
            }
            if band.get('description', '') != '':
                extracted_band['description'] = band.get('description', '')

            extracted_band['colorInterpretation'] = band.get('colorInterpretation', '')
            extracted_band['noDataValue'] = band.get('noDataValue', None)
            if not isRGB:
                extracted_band['displayMin'] = band.get('computedMin', None)
                extracted_band['displayMax'] = band.get('computedMax', None)

            bands.append(extracted_band)

        extracted_data['isRGB'] = isRGB
        if isRGB:
            extracted_data['noDataValueRGB'] = [0,0,0]
        extracted_data['bands'] = bands

    return extracted_data

json.dump(extract_data(json.load(sys.stdin)), sys.stdout, indent=4)