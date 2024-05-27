
# Custom Overlays feature for the *Jaia Command & Control* Website
The *Jaia Command & Control* website includes a control named "Map Layers" that allows you to enable and disable various layers on the maps.   The *Custom Overlays* feature allows you to add your own custom layers to the map in order to assist you when planning and running your missions.

## Prerequisites
- Install the GDAL tools to get *gdalinfo* (please see https://gdal.org/index.html for information on GDAL):
                `sudo apt install gdal-bin`
                (Question: Should this be installed automatically as part of a Hub setup script?)
- Create the directory where you will store your custom overlays:
                `sudo mkdir -p /usr/share/jaiabot/overlays`
                (Questions: Should this be added to some script so it's created automatically?  What owner, group, and permissions?)

## Installing a Custom Overlay
1. The custom overlays reside on the Jaia Hub server; the process to install a custom overlay onto the Hub is straight-forward:
2. Copy the overlay image to the /usr/share/jaiabot/overlays directory on the Jaia Hub.
3. Run the scripts/geotiff_scan.sh script on your new overlay image to create a .meta.json file; this file contains metadata extracted from the overlay image.
4. Edit the .meta.json file if necessary (e.g. you started with JPEG/PNG or wish to adjust the overlay's presentation - please see the Metadata section below for details on the .meta.json file)
5. Either browse to the *Jaia Command & Control* website using a fresh browser, or refresh your browser page.
6. Using the Map Layers control, bring up the Map Layers dialog
7. If it wasn't previously present, there should now be a Custom Overlays accordion folder.
8. Open the Custom Overlays folder and select the checkbox to activate your new layer.
9. If you want to adjust the overlay's presentation, then repeat steps 4-8.  For information on what can be adjusted, please see the Metadata documentation below.

Note that the custom overlay feature looks for both the image filename (e.g. sample.tif) and its .meta.json metadata file (e.g. sample.tif.meta.json), and will ignore all images without a metadata file and will ignore all metadata files without an image file.
## Custom Overlay Image Format and Requirements
- The custom overlay feature supports GeoTiff, JPEG, and PNG file formats.  Note that normal TIFF files lacking geospatial data are not supported.
- The file should use the appropriate lower-case extension from the following list:
        - JPEG: .jpg or .jpeg
        - PNG: .png
        - GeoTIFF: .tif or .tiff
- The custom overlay image should have a level of detail (resolution) that would be useful at the maximum zoom you expect to use.
- For the GeoTIFF format:
    - The custom overlay feature supports a single image per overlay file, representing a single map area. Consequently, this feature does not accommodate the inclusion of resolution pyramids (or overviews) and multi-images within a single GeoTIFF file.
    - The custom overlay feature supports multiple bands in a GeoTIFF file - each band creates a separate overlay.
    - The custom overlay feature interprets a GeoTIFF with the first three bands whose colorInterpretations are _Red_, _Green_, and _Blue_ as a single color image raster and ignores additional bands.
    - The custom overlay feature also will interpret a single band whose colorInterpretation is _Palette_ as a color image raster.
    - If the first three bands are not Red/Green/Blue, then it displays each band independently using a gray scale (though this gray scale can be colorized by editing the .meta.json file).
## Metadata
The tables below define all the possible fields that the metadata file might contain.  Note that many of the fields are properly set when you run the geotiff_scan.sh script.  Most of the remaining fields are not required and have reasonable defaults, so you only have to adjust the fields that control the display options you want to change.

Note that if your overlay is a JPEG or PNG then you *must* edit the meta.json file to include the overlay's map projection and extent.

You can adjust the following metadata values that apply to the image, including all its bands:

| Field             | Type            | Required | Default                                   | Description/Notes                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------- | --------------- | -------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| description       | string          | No       | The filename minus the extension          | The text that displays in the Custom Overlays dialog.  Note that the description should be unique; if not then it will be decorated with other file attributes (e.g. extension or filename) to make it unique.                                                                                                                                                                                             |
| sortKey           | string          | No       | description + filename + *band-specifier* | The key used to sort the custom overlays for display in the Custom Overlays dialog; please see below for more information on Bands and the band-specifier                                                                                                                                                                                                                                                  |
| license           | string          | No       | *None*                                    | Optional license name/link for bottom left corner                                                                                                                                                                                                                                                                                                                                                          |
| proj4             | string          | Yes \*   | *None* \*\*                               | The Proj4 projection specification (e.g. *+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs*)                                                                                                                                                                                                                                                                                                               |
| epsg              | string          | Yes \*   | *None* \*\*                               | The EPSG projection specification, which should start with EPSG: (e.g. *EPSG:4326*)                                                                                                                                                                                                                                                                                                                        |
| cornerCoordinates |                 | Yes      | *None*                                    | The extent specification, represented by coordinates of bottom-left and top-right corners; please see below for more details on cornerCoordinates                                                                                                                                                                                                                                                          |
| noDataValueRGB    | number[&nbsp;]        | No       | *None* (all raster pixels displayed)      | A triplet of colors to be treated as transparent; the geotiff_scan.sh script suggests [0,0,0] for noDataValueRGB, but you can delete that if you want to display all black pixels.  Note that this check is in addition to the noDataValue in the individual RGB bands.                                                                                                                                    |
| zindex            | number or null  | No       |                                           | File-specific display options - middle priority; please see the Display Options section below for more details on display options and their defaults.                                                                                                                                                                                                                                                      |
| opacity           | number or null  | No       |                                           | "                                                                                                                                                                                                                                                                                                                                                                                                          |
| invert            | boolean or null | No       |                                           | "                                                                                                                                                                                                                                                                                                                                                                                                          |
| chromaScale       | string or null  | No       |                                           | "                                                                                                                                                                                                                                                                                                                                                                                                          |
| isRGB             | boolean         | No       | *false* (i.e. display each band)          | If true, then treat the three bands as RGB pixel color.  There are two ways GeoTIFF files can contain RGB images:<br>1. Via three different bands.  The `geotiff_scan.sh` script will set isRGB *true* if your image has just three bands and their colorInterpretations are Red, Green, and Blue; you can set isRGB to *false* if you really want to display the Red/Green/Blue bands separately.  Or, if your first three bands represent RGB values but are not labeled Red, Green, and Blue, then you can manually set isRGB to *true*.<br>2. Via one band whose type is 'Palette'.  The `geotiff_scan.sh` script will automatically set isRGB *true* if your image has just one band and its colorInterpretation is Palette. The `geotiff_scan.sh` script will also output three bands into the metadata to represent the virtual red/green/blue bands, because the Custom Overlay feature requires three bands to display a RGB image. |
| bands             | Band[&nbsp;]          | No       | *None*                                    | Meta data for all the bands in the file - this will not be present for a JPEG/PNG file.  Please see below for more information on Bands.                                                                                                                                                                                                                                                                   |

* \* You must set either the proj4 or the epsg projection specifier.  For GeoTIFF files, the geotiff_scan.sh script automatically fills in the proj4 field from the GeoTiff metadata, but you must manually add this information for JPEG/PNG files.  Edge cases:
        * If you specify both the proj4 and epsg fields, then it will use the proj4 field.
        * If your proj4 field starts with "EPSG:" then it will be moved to the epsg field, overriding any value it may have.
* \*\* For a JPEG/PNG images, if you do not provide a projection, then *Jaia Command & Control* will log a warning to the browser's developer's console, and attempt to display your overlay; however, be aware that it will likely not appear on the map.

### cornerCoordinates
The CornerCoordinates define the extent of the image.  This is used only for JPEG/PNG  because the custom overlay feature automatically extracts the cornerCoordinates from the image.

| Field      | Type                | Required | Default     |
| ---------- | ------------------- | -------- | ----------- |
| lowerLeft  | [number, number] \* | Yes \*\* | *None* \*\* |
| upperRight | [number, number] \* | Yes \*\* | *None* \*\* |
- \* The units for the number are defined by the projection.  For example, for EPSG4326, you'd specify latitude and longitude; other projections may require coordinates measured in meters from a reference point.
- \*\* If you do not provide an extent, then *Jaia Command & Control* will log a warning to the browser's developer's console, then attempt to display your overlay; however, be aware that it will likely not appear on the map.

### Display Options
There are four options that affect the display of the layer, as shown in the table below.  You do not need to set these options, they default to the values shown in the next section below.  However, if you do want to override the defaults, you can do so at two separate levels: a file-wide set of options (set in the base metadata described above) and a per-band set of options (set in the Band metadata described below).  The per-band options have highest priority, then the per-file options, then the default options.  Note that the per-band options are not used for JPEG/PNG images nor RGB GeoTIFF images.

| Field       | Type            | Required | Default         | Description/Notes                                                                                                                                                                                                                                                                                               |
| ----------- | --------------- | -------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| zindex      | number or null  | No       | See table below | Z-index of overlay - should be one or greater to appear above the base map, therefore 0 or null are treated as 1.  Ties are displayed using sort order (first appearance in the Custom Overlays dialog will be the lowest layer).                                                                               |
| opacity     | number or null  | No       | "               | 0-1 (as in CSS) or 2-255 (as in the A channel); *null* is equivalent to opaque.                                                                                                                                                                                                                                 |
| invert      | boolean or null | No       | "               | Set to *true* to invert.  This can be useful for grayscale displays to change the apparent direction (e.g. convert elevation to depth).  You can also invert RGB, though unless your RGB data starts out inverted, this will result in a strange "photo negative" appearance.  *null* is equivalent to *false*. |
| chromaScale | string or null  | No       | "               | Colorize a grayscale using the *scale* method of the chroma-js NPM package; *null* means no colorization. \*                                                                                                                                                                                                    |
- \* Please see https://gka.github.io/chroma.js/#chroma-scale for more details on the *scale* method of chroma-js.  Any scale you provide is interpolated in 'hsl' mode, and then made somewhat pastel by increasing the the lightness by 20% and decreasing the saturation by 40%.  For example, a pleasing chromaScale would be ["red", "orange", "yellow", "green", "blue"].

### Defaults
These are the default values for the display options:

| Field       | Default | Description/Notes                                                   |
| ----------- | ------- | ------------------------------------------------------------------- |
| zindex      | 42      | 42 should be higher than the other layers - tip-of-the-hat to HGTTG |
| opacity     | 1.0     | Fully opaque                                                        |
| invert      | false   | Do not invert                                                       |
| chromaScale | null    | No colorization - use grayscale.                                    |

### Band
The *bands* field in the base metadata is an array of band metadata, where each band contains the following values:

| Field               | Type             | Required | Default                                                      | Description/Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ---------------- | -------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| band                | number;          | Yes      | *None*                                                       | 1-N                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| description         | string or null   | No       | *Band NN*, where NN is the band number padded to two dights. | Many GeoTIFF files include a description of each band. When available, the `geotiff_scan.sh` script copies the value to this field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| colorInterpretation | string or null   | No       | *None*                                                       | The `geotiff_scan.sh` script extracts the `colorInterpretation` attribute from each band in the the GeoTIFF file. This attribute can be 'Pallette', 'Red', 'Green', 'Blue', or 'Gray'. If the attribute is set to any other value, or is undefined/null, it will be treated as 'Gray'. The `geotiff_scan.sh` script performs two actions with the colorInterpretation:<br><br>1. It copies the colorInterpretation value to this field in the metadata file.<br>2. It utilizes this value to set the 'isRGB' indicator within the base metadata.<br><br>Once these steps are completed, the `colorInterpretation` value is retained for informational purposes only and is not used in any further processing. |
| displayMin          | number           | Yes      | *None*                                                       | Minimum data value (excluding the noDataValue)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| displayMax          | number           | Yes      | *None*                                                       | Maximum data value (excluding the noDataValue).  The minimum and maximum values are used to create the gray scale.  Any data values falling below the minimum are automatically adjusted to the minimum value, while those exceeding the maximum are adjusted to the maximum value                                                                                                                                                                                                                                                                                                                              |
| noDataValue         | number or string | No       | *None*                                                       | This field specifies a value to be treated as 'no data' in the dataset. Any data points matching the `noDataValue` will be rendered as transparent pixels, effectively being ignored in the display. When the `noDataValue` is 'NaN' (Not a Number), use the string 'NaN' for representation, as JSON does not support the NaN value directly                                                                                                                                                                                                                                                                   |
| skip                | boolean or null  | No       | *false*                                                      | Null is the same as false; set this to true to ignore this band.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| zindex              | number or null   |          |                                                              | Band-specific display options - highest priority.  Please see the Display Options section above for more details on display options and their defaults.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| opacity             | number or null   |          |                                                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| invert              | boolean or null  |          |                                                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| chromaScale         | string or null   |          |                                                              |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Debugging

- Check if the Hub recognizes your overlay.  To do this, browse to: http://*hubIP*:40001/geoTiffs  then, examine the returned JSON and verify that your overlay appears in the array, and has the correct metadata.   If your overlay is not in the returned list, then verify:
        - The file ends in .tif, .tiff, .png, .jpg, or .jpeg
        - There is a matching metadata file that has the same name as the image file (including its extension) plus *.meta.json*
        - Both files have suitable permissions that allow it to be read by the Hub web server
        - The metadata file contains valid JSON
- If your overlay still does not show up once it appears in the the */geoTiffs* list, then use the browser's Developer Tools and check the console for any error/warning messages about the overlays; if present, these messages should tell you how to proceed.
- If there are no errors in the Developer's console and the overlay still does not show up:
        - For non-GeoTIFF images: make sure the image displays in a browser, and make sure your projection and cornerCoordinates declarations are correct (if those are wrong, then the image may well appear in a place other than what you're expecting, or the image may not show up at all).
        - For a GeoTIFF image: Use GDAL tools (e.g. gdalinfo) to verify that the GeoTIFF conforms to the requirements outlined above and has the desired data (please see: https://gdal.org/index.html for more information on the GDAL tools).
* For GeoTIFF images, if your overlay appears, but doesn't appear correctly then make sure you verify the following fields are correctly set in the metadata file:
        * isRGB - if this is set incorrectly, you could have three independent grayscale overlays instead of a single RGB overlay.  Note, however, that without setting the displayMin and displayMax values (to 0 and 255 respectively), the three overlays will likely display as all black.
        * noDataValue - if this is not set, then you could have unwanted large areas of black or white surrounding your overlay.
        * displayMin and displayMax - if these are improperly set, then your overlay may appear to have only two colors (e.g. for grayscale, you'd only see black and white).  This can easily happen if your displayMin and/or displayMax includes the noDataValue, and the noDataValue is significantly far from the band's data range.

(Question:  The displayMin and displayMax limits currently force out-of-bounds pixels to either the min or max, and displays them; should we support an additional parameter that causes out-of-bounds pixels to be transparent?  This could be useful if you only wanted to see a particular subset of the data that falls within narrower bounds than the entire dataset.)
## Examples
### PNG Image - Minimal Metadata
```
{
    "epsg": "EPSG:4326",
    "cornerCoordinates": {
        "lowerLeft": [
            -71.274898,
            41.662032
        ],
        "upperRight": [
            71.273618,
            41.663005
        ]
    }
}
```

### PNG Image - Typical Metadata
The following example represents a hypothetical PNG image containing a map we'd like to overlay in a particular location.
```
{
    "description": "Herreshoff dock",
    "extension": ".png",
    "sortKey": "02",
    "license": "© <a href=\"https://commons.wikimedia.org/wiki/Commons:Licensing\">Herreshoff</a>",
    "epsg": "EPSG:4326",
    "zindex": 20,
    "cornerCoordinates": {
        "lowerLeft": [
            146.814691,
            -41.161841
        ],
        "upperRight": [
            146.892519,
            -41.128482
        ]
    }
}
```

### GeoTIFF - RGB Minimal Metadata
```
{
    "proj4": "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs",+units=m +no_defs",
    "isRGB": true,
    "bands": [
        {
            "band": 1,
            "colorInterpretation": "Red"
        },
        {
            "band": 2,
            "colorInterpretation": "Green"
        },
        {
            "band": 3,
            "colorInterpretation": "Blue"
        }
    ]
}
```

### GeoTIFF - RGB Typical Metadata
The following example represents a hypothetical GeoTiff which contains elevation data encoded into RGB pixels.
```
{
    "description": "Site Elevation",
    "extension": ".tif".
    "license": "© <a href=\"https://commons.wikimedia.org/wiki/Commons:Licensing\">MyOrg</a>",
    "proj4": "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs",+units=m +no_defs",
    "sortKey": "01",
    "isRGB": true,
    "noDataValueRGB": [
        0,
        0,
        0
    ],
    "bands": [
        {
            "band": 1,
            "colorInterpretation": "Red",
            "noDataValue": null
        },
        {
            "band": 2,
            "colorInterpretation": "Green",
            "noDataValue": null
        },
        {
            "band": 3,
            "colorInterpretation": "Blue",
            "noDataValue": null
        }
    ]
}
```

### GeoTIFF - Data Band Minimal Metadata
```
{
    "proj4": "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs",+units=m +no_defs",
    "isRGB": false,
    "bands": [
        {
            "band": 1,
            "displayMin": -7.666,
            "displayMax": -1.26
        },
    ]
}
```

### GeoTIFF - Data Band Typical Metadata
The following example represents a hypothetical GeoTiff which contains depth data from the year 2022 and elevation data for 2023 and 2024.  You'd like to convert the 2022 depth information to elevation (by inversion), colorize the elevation data, and set the 2024 layer to be transparent so it can be visually compared to 2022 data.  Furthermore, the image uses a floating point values for each pixel, and uses NaN to mark pixels that have no data.  We've modified the displayMin and displayMax in all bands to the inter-band mins and maxes so that the grayscales for each band will align.
```
{
    "description": "Selected Elevations",
    "extension": ".tif",
    "license": "© <a href=\"https://commons.wikimedia.org/wiki/Commons:Licensing\">MyOrg</a>",
    "sortKey": "03",
    "proj4": "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs",+units=m +no_defs",
    "isRGB": false,
    "chromaScale": ["blue", "green", "yellow", "orange", "red"],
    "bands": [
        {
            "band": 1,
            "description": "Elevation (m) 2024",
            "colorInterpretation": "Gray",
            "noDataValue": "NaN",
            "displayMin": -7.7,
            "displayMax": -1.25,
            "zindex": 22,
            "opacity": 0.5
        },
        {
            "band": 2,
            "description": "Elevation (m) 2023",
            "colorInterpretation": "Gray",
            "noDataValue": "NaN",
            "displayMin": -7.7,
            "displayMax": -1.25,
            "zindex": 21,
            "skip": true,
        },
        {
            "band": 3,
            "description": "Depth (m) 2022",
            "colorInterpretation": "Gray",
            "noDataValue": "NaN",
            "displayMin": 1.25,
            "displayMax": 7.7,
            "zindex": 20,
            "invert": true,
        },
    ]
}
```
# Appendix: GeoTIFF vs JPEG/PNG Overlays
- GeoTIFFs pros and cons:
  - Pro: GeoTIFFs include metadata that specifies the projection and extent of the image, and thus are a bit easier to correctly position on the map.
  - Pro: GeoTIFFs can include multiple arbitrary datasets (bands)
  - Con: You may need to specify/adjust how to the display each data band in order for it to display properly.
  - Con: The GeoTIFFs specification supports advanced features such as files containing multiple distinct images and images containing resolution pyramids (for efficient zooming/panning) that the custom overlay feature does not support.
  - Con: Many image processing tools have mixed support for creating and viewing GeoTIFF images, and thus you may need to use specialized software for this purpose.
- JPEG/PNG pros and cons:
  - Pro: JPEG/PNG images are easier to create and manipulate as they are well supported by most image processing software.
  - Con: JPEG/PNG images do not contain georeferenced metadata (i.e. image extent and projection of the map), and thus you need to supply that information separately and correctly.