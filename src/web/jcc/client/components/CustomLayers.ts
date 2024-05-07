import LayerGroup from 'ol/layer/Group'
import { persistVisibility } from './VisibleLayerPersistance'
import ImageLayer from 'ol/layer/Image.js';
import BaseLayer from 'ol/layer/Base.js'
import ImageStatic from 'ol/source/ImageStatic.js';

import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { get as getProjection } from 'ol/proj';
import { GeoTIFF, GeoTIFFImage, Pool, fromArrayBuffer, TypedArrayWithDimensions } from 'geotiff';

import { RasterMetadata } from './CustomLayerRasterWorker';
import { CustomLayerRasterWorkerPool } from './CustomLayerRasterWorkerPool';

import pLimit from 'p-limit';
import { pick } from 'lodash';
import { EventEmitter } from 'events';


interface CornerCoordinates {
    lowerLeft:  [number, number];
    upperRight: [number, number];
}

interface DisplayOptions {        // Precedence: Highest: Band-specific, then: file-specific, then:defaults
    zindex:      number | null,   // Zindex of overlay - ties are in sort order (first is lowest)
    opacity:     number | null,   // 0-1 (as in CSS) or 2-255 (as in the A channel)
    invert:      boolean | null,  // True to invert RGB (may be strange) or Grayscale
    chromaScale: string | null,   // Color a grayscale using chroma-js specification
};

const DefaultDisplayOptions : DisplayOptions = {  // Defaults are lowest-priority
    opacity:     1.0,     // Fully opaque
    invert:      false,   // Do not invert
    chromaScale: null,    // No colorization
    zindex:      42,      // Should be higher than other layers - tip-of-the-hat to HGTTG
};

export interface Band {
    band:                number;            // 1-N
    description?:        string | null;     // Supplied in many GeoTiffs; change in .json if desired
    colorInterpretation: string | null;     // Red, Green, Blue, Gray; Undefined/null = Gray
    displayMin:          number;            // Minimum data value (excluding noDataValue)
    displayMax:          number;            // Maximum data value
    noDataValue?:        number  | string;  // string for "NaN" because NaN can't be reprsented in JSON
    skip:                boolean | null;    // Null is the same as false; true to ignore this band
    zindex?:             number  | null;    // Band-specific display options - highest priority
    opacity?:            number  | null;
    invert?:             boolean | null;
    chromaScale?:        string  | null,
}

interface GeoTiffMetadata {
    description:         string;          // Starts out as filename w/o extension, change in metadata if desired
    extension:           string;          // Image file extension (e.g. .tif or .jpg)
    sortKey?:            string;          // Dynamically-generated - provide fixed value in metadata if desired
    license?:            string;          // Optional license name/link for bottom left corner
    proj4?:              string;          // Proj4 projection specification
    epsg?:               string;          // EPSG projection specification
    cornerCoordinates?:  CornerCoordinates;  // Coordinates of bottom-left and top-right corners
    noDataValueRGB?:     number[];        // A triplet of colors to be treated as transparent
    zindex?:             number  | null;  // File-specific display options - middle priority
    opacity?:            number  | null;
    invert?:             boolean | null;
    chromaScale?:        string  | null,
    isRGB?:              boolean;         // Treat the three bands as RGB pixel color
    bands?:              Band[];          // All the bands in the file
                                          // The rest of these are dynamically generated - do not try to override
    filename?:           string;          // The full filename
    error?:              string;          // .meta.json parse error, if any
    title?:              string;          // The unique name for the UI
    band?:               Band;            // The band for this entry
    displayOptions?:     DisplayOptions;  // The effective display options
}

interface LoadedGeoTiff {
    blob: Blob | null;
    extent: number[] | null;
}


class ManagedGeotiffDecoderPool {
    private _geotiffDecoderWorkerPool: Pool;
    private poolSize: number;
    private usageCount: number;
    private poolIdleLifetimeSecs: number;
    private poolIdleTimer: NodeJS.Timeout | null;
    private debug: boolean;

    constructor(poolSize: number, poolIdleLifetimeSecs: number) {
        this.debug = false;
        this._geotiffDecoderWorkerPool = null;
        this.poolIdleLifetimeSecs = poolIdleLifetimeSecs;
        this.poolSize = poolSize;
        this.usageCount = 0;
    }

    get geotiffDecoderWorkerPool() {
        this.usageCount++;
        this.debug && console.log('Incrementing decoder worker pool ref count to:', this.usageCount);
        if (!this._geotiffDecoderWorkerPool) {
            this._geotiffDecoderWorkerPool = new Pool(this.poolSize);
        }
        if (this.poolIdleTimer) {
            this.debug && console.log('Clearing the decoder worker pool idle timer.');
            clearTimeout(this.poolIdleTimer);
            this.poolIdleTimer = null;
        }
        return this._geotiffDecoderWorkerPool;
    }

    releasePoolReference() : void {
        if (this.usageCount) {
            this.usageCount--;
            this.debug && console.log('Decrementing decoder worker pool ref count to:', this.usageCount);
        } else {
            console.error('Error: decoder worker pool reference count usage is unbalanced.')
        }
        if (!this.usageCount) {
            this.debug && console.log('Setting the decoder worker pool idle timer.');
            this.poolIdleTimer = setTimeout(() => {
                this.debug && console.log('Terminating the decoder worker pool due to idle timeout.');
                this._geotiffDecoderWorkerPool.destroy();
                this._geotiffDecoderWorkerPool = null;
                this.poolIdleTimer = null;
            }, this.poolIdleLifetimeSecs * 1000);
        }
    }
}


//
// CustomLayerGroupFactory is a class that creates the CustomLayerGroup.  This class seems a bit
// more complicated than it should be, but that's for a good reason: We don't want to create the
// "Custom Overlay" group in the UI unless there is one or more actual custom overlays.  However, it
// takes time to download and validate the custom layers metainfo, so we'll need to asynchronously
// create the CustomLayerGroup and add it to the map after it is created.  We make this happen using
// events:
// * We add event emitters to the CustomLayerGroupFactory and Layers classes.
// * The CustomLayerGroupFactory creates the customLayerGroup, then emits a "ready:customLayerGroup"
//   event that includes the new group, but only if there are one or more active custom overlays.
// * The Layers class in Layers.ts creates the various layers, but instead of immediately creating the "Custom
//   Overlays" layer like it does for the other layers, it instead instantiates this factory and listens
//   for the "ready" event.
// * When the Layers class receives the "ready" event, it emits its own "ready" event, which forwards
//    the newly created CustomLayerGroup along.
// * The CommandControl.tsx module is the only place that has access to the Map and its layers, and
//   therefore the only place where we can add a new layer.  After the CommandControl.tsx module
//   calls CreateMap(), it also adds a listener for the "ready" event from the Layers class.  When
//   it receives that event, it inserts the new CustomLayerGroup into the map's layers.
//
export class CustomLayerGroupFactory {
    private eventEmitter: EventEmitter;
    private geotiffDecoderPool: ManagedGeotiffDecoderPool;
    private rasterWorkerPool: CustomLayerRasterWorkerPool;
    private debug: boolean;

    static readonly geoTiffServerUrl = '/geoTiffs';
    static readonly customLayerGroupReady = 'ready:customLayerGroup';
    static readonly customLayerWorkerURL = '/customLayerWorker.js'

    constructor() {
        this.debug = false;
        this.eventEmitter = new EventEmitter();
        const rasterWorkerCount = 2;
        let geotiffDecoderCount = (navigator.hardwareConcurrency - rasterWorkerCount);
        geotiffDecoderCount = geotiffDecoderCount >= 2 ? geotiffDecoderCount : 2;
        this.geotiffDecoderPool = new ManagedGeotiffDecoderPool(geotiffDecoderCount, 30);
        this.rasterWorkerPool = new CustomLayerRasterWorkerPool(rasterWorkerCount, 30);
    }


    on(eventName: string, listener: (arg: any) => void): void {
        this.eventEmitter.on(eventName, listener);
    }
    emit(eventName: string, arg: any): void {
        this.eventEmitter.emit(eventName, arg);
    }

    async createCustomLayerGroup(): Promise<void> {
        // To start with, we grab the list of custom overlays from the Hub server and sort them.
        let geoTiffs: GeoTiffMetadata[];
        try {
            const response = await fetch(CustomLayerGroupFactory.geoTiffServerUrl);
            if (!response.ok) {
                throw new Error(`fetch ${CustomLayerGroupFactory.geoTiffServerUrl} failed with status ${response.status}: ${response.statusText}`);
            }
            geoTiffs = await response.json() as GeoTiffMetadata[]
        } catch(ex) {
            console.error('Error while fetching GeoTIFFs list: ', ex);
            return;
        }
        const sortedGeoTiffs = this.sortGeoTiffNamesAndMakeUnique(geoTiffs);
        if (sortedGeoTiffs.length == 0) {
            return;
        }

        // Now construct the LayerGroup and add all the custom overlays
        const layers: BaseLayer[] = [];
        const customOlLayerGroup = new LayerGroup({
            properties: {
                title: 'Custom Overlays',
                fold: 'close',
            },
            layers,
        });
        customOlLayerGroup.setVisible(true);
        this.emit(CustomLayerGroupFactory.customLayerGroupReady, customOlLayerGroup);

        const createdLayers = sortedGeoTiffs.map(geoTiff => ({
            geoTiffMd:    geoTiff,
            overlayLayer: this.createGeoTiffLayer(geoTiff),
        }));
        createdLayers.forEach(layer => customOlLayerGroup.getLayers().push(layer.overlayLayer));

        // Now we need to fetch each GeoTIFF that is currently selected (i.e. was selected during
        // the previous use of this website).  If the GeoTIFF was not selected, then we need to
        // set up a listener to fetch the GeoTIFF if/when it eventually becomes visible.
        //
        // However, fetch no more than 4 GeoTiffs at a time, using the pLimit class as a throttle.
        const limit = pLimit(4);
        const layerPromises = createdLayers.map(layer => limit(() => this.loadGeoTiffLayer(layer.geoTiffMd, layer.overlayLayer)));
        const loadedLayers = await Promise.all(layerPromises);
    }

    // Sort the custom overlay names and makes them unique, and also expand GeoTIFFs
    // with multiple bands into separate custom overlays.
    private sortGeoTiffNamesAndMakeUnique(geoTiffs: GeoTiffMetadata[]): GeoTiffMetadata[] {
        const displayOptionsKeys = Object.keys(DefaultDisplayOptions);

        // Compute the sort key, which defaults to the description + file name.  Then,
        // expand the GeoTiff list so that each displayable band has its own entry in the list;
        // we'll add the band's description to both the base description and the sort key.
        // Last aggregate the display options (zindex, opacity, etc.) in priority order:
        //     Highest: band-specific, then: file-specific, then: defaults
        const keyedGeoTiffs = geoTiffs.reduce((accum, geoTiffItem) => {
            if (geoTiffItem.error) {
                console.warn(`Warning: ignoring ${geoTiffItem.filename} due to this JSON error: ${geoTiffItem.error}
                Please correct the metadata JSON file.`)
                return accum;
            }
            for (let i = 0;  i < (geoTiffItem.bands?.length ?? 1);  i++) {
                const newItem = Object.assign({}, geoTiffItem);
                let dotPos = newItem.filename.lastIndexOf('.');
                dotPos = dotPos > 0 ? dotPos : newItem.filename.length
                const userDefinedSortKey = newItem.sortKey;
                newItem.description = newItem.description ?? newItem.filename.substring(0, dotPos);
                newItem.extension = newItem.extension ?? newItem.filename.substring(dotPos);
                newItem.sortKey = userDefinedSortKey ?? newItem.description + newItem.filename;
                newItem.displayOptions = Object.assign({}, DefaultDisplayOptions, pick(geoTiffItem, displayOptionsKeys));
                accum.push(newItem);

                if (!geoTiffItem.bands) {
                    break;  // Likely a PNG or JPEG - a GeoTIFF should have at least one band!
                } else if (newItem.isRGB && geoTiffItem.bands.length >= 3) {
                    break;  // Process the RGB bands as one band
                } else {
                    // If we have multiple display bands, then augment the description and sortKey with the band name
                    newItem.band = Object.assign({}, geoTiffItem.bands[i]);
                    if (newItem.band.skip) {
                        accum.pop();
                        continue;
                    }
                    const hasMultipleBands = geoTiffItem.bands.length > 1;
                    const bandName = newItem.band.description ??
                                    (hasMultipleBands && `Band ${i.toString().padStart(2, '0')}` || '');
                    if (bandName) {
                        const bandNameSuffix = ` - ${bandName}`;
                        newItem.description += bandNameSuffix;
                        if (!userDefinedSortKey) {
                            newItem.sortKey += bandNameSuffix
                        }
                    }
                    newItem.displayOptions = Object.assign(newItem.displayOptions, pick(newItem.band, displayOptionsKeys));
                }
            }
            return accum;
        }, []);
        const sortedGeoTiffs = keyedGeoTiffs.sort((a, b) => (a.sortKey > b.sortKey ? 1 : (a.sortKey < b.sortKey ? -1 : 0)));

        // Generate a unique title for the Custom Overlay dialog, starting with the description and
        // making it unique.  Filenames are unique, but are ugly when displayed with the extension,
        // so the geotiff_scan.sh script defaults the description to be the filename without the
        // extension.  Then, the metadata file can be edited to contain an arbitrary description.
        // Both these mean the description can conflict with other files (i.e. more than one image
        // file can have the same description).  Therefore we want to make the shortest unique
        // display name, using the description and adding enough extra attributes to make it unique.
        // In practice, you might want to edit the description to make it unique rather than use the
        // description with these extra attributes.  Note that the custom overlays are sorted via
        // the sortKey regardless of the unique description, and thus the custom overlay list can
        // appear like it wasn't sorted properly (i.e. sorted by the displayed title).

        // Count descriptions and description + extension
        interface CountMap {
            [key: string]: number;
        }
        const desc: CountMap = {};
        const descExt: CountMap = {};
        sortedGeoTiffs.forEach(item => {
            const descKey = item.description;
            const descExtKey = item.description + ' ' + item.extension.slice(1);

            desc[descKey] = (desc[descKey] || 0) + 1;
            descExt[descExtKey] = (descExt[descExtKey] || 0) + 1;
        });

        // Set the title based on uniqueness
        sortedGeoTiffs.forEach(item => {
            const descKey = item.description;
            const descExtKey = item.description + ' ' + item.extension.slice(1);

            if (desc[descKey] == 1) {
                item.title = item.description;                          // description is unique
            } else if (descExt[descExtKey] == 1 && desc[descExtKey] == 0) {
                item.title = descExtKey;                                // description + extension is unique
            } else {
                item.title = item.description + ' - ' + item.filename;  // Use description + ' - ' + filename
            }
        });
        return sortedGeoTiffs;
    }

    // Create the OpenLayers Layer that will contain the custom overlay.
    // Then create an event handler to load the overlay when it becomes
    // visible (i.e. the user selects the custom layer).
    private createGeoTiffLayer(geoTiffMd: GeoTiffMetadata): ImageLayer<ImageStatic> {
        const imageOverlay: ImageLayer<ImageStatic> = new ImageLayer({
            properties: {
                title: geoTiffMd.title,
            },
            zIndex: geoTiffMd.displayOptions.zindex,
        });

        persistVisibility(imageOverlay);
        imageOverlay.on('change:visible', (event) => this.loadGeoTiffSource(imageOverlay, geoTiffMd));

        return imageOverlay;
    }

    private getExtentFromCornerCoordinates(cornerCoordinates: CornerCoordinates, filename: string): number[] {
        const extent = [];
        extent[0] = cornerCoordinates.lowerLeft?.[0];
        extent[1] = cornerCoordinates.lowerLeft?.[1];
        extent[2] = cornerCoordinates.upperRight?.[0];
        extent[3] = cornerCoordinates.upperRight?.[1];
        const hasNonNumber = extent.some((el: any) => isNaN(parseFloat(el)) || el == null);
        if (hasNonNumber) {
            console.warn(`Warning: custom overlay ${filename} has an incomplete extent; it likely will not display.
            Please correct the cornerCoordinate information to the metadata JSON file.`)
        }
        return extent;
    }

    // Create the OpenLayers Layer that will contain the custom overlay.  If the overlay is visible
    // then immediately load it into the layer.  Otherwise, create an event handler to load the
    // overlay when it becomes visible (i.e. the user selects the custom layer.)
    private async loadGeoTiffLayer(geoTiffMd: GeoTiffMetadata, imageOverlay: ImageLayer<ImageStatic>): Promise<BaseLayer> {
        if (imageOverlay.getLayerState().visible) {
            this.debug && console.log(`Loading ${geoTiffMd.filename}`);
            await this.loadGeoTiffSource(imageOverlay, geoTiffMd);
        }

        return imageOverlay;
    }


    // This loads the GeoTIFF itself into the layer.  For JPEG/PNG images, this is straight-forward:
    // create a new Static layer, set its projection and extent, then point it at the image's URL.  For GeoTIFFs, however,
    // we use the loadGeoTiff() method to bounce the band data into a canvas, and then attach that to the Static layer.
    private async loadGeoTiffSource(imageOverlay: ImageLayer<ImageStatic>, geoTiffMd: GeoTiffMetadata) {
        if (!imageOverlay.getLayerState().visible) {
            return;  // Nothing to do if we're not visible
        }

        const overlaySource = imageOverlay.getSource();
        if (overlaySource) {
            return;  // Nothing to do if our source is already present
        }

        // If the metadata has the ESPG: code in the proj4 field, then move it
        // to the espg field (unless the espg field is filled in), in which case
        // we want to preferentially use the epsg field.
        if ((geoTiffMd.proj4 || '').startsWith('EPSG:')) {
            if (!geoTiffMd.epsg) {
                geoTiffMd.epsg = geoTiffMd.proj4;
            }
            geoTiffMd.proj4 = null;
        }
        if (geoTiffMd.proj4) {
            proj4.defs(geoTiffMd.filename, geoTiffMd.proj4);
            register(proj4);
        }
        if (!geoTiffMd.proj4 && !geoTiffMd.epsg) {
            console.warn(`Warning: custom overlay ${geoTiffMd.filename} is missing its projection; it likely will not display.
            Please add projection information to the metadata JSON file.`)
        }

        let source: ImageStatic;
        if (!geoTiffMd.bands) {
            // Load in a normal, non-GeoTIFF image (JPEG, PNG)
            let extent: number[] = [ 0, 0, 0, 0 ];
            if (!geoTiffMd.cornerCoordinates) {
                console.warn(`Warning: custom overlay ${geoTiffMd.filename} is missing its extent; it likely will not display.
                Please add cornerCoordinate information to the metadata JSON file.`)
            } else {
                extent = this.getExtentFromCornerCoordinates(geoTiffMd.cornerCoordinates, geoTiffMd.filename);
            }
            source = new ImageStatic({
                url: `${CustomLayerGroupFactory.geoTiffServerUrl}/${encodeURIComponent(geoTiffMd.filename)}`,
                attributions: geoTiffMd.license,
                projection: geoTiffMd.proj4 && getProjection(geoTiffMd.filename) || geoTiffMd.epsg,
                imageExtent: extent,
            });
        } else {
            // Load in a GeoTIFF
            const {blob, extent} = await this.loadGeoTiffUsingWorkers(imageOverlay, geoTiffMd);
            if (!blob || !extent) {
                return;  // Could not load the image, so we can't create a source from it.
            }
            const objectURL = URL.createObjectURL(blob);
            source = new ImageStatic({
                url: objectURL,
                attributions: geoTiffMd.license,
                projection: geoTiffMd.proj4 && getProjection(geoTiffMd.filename) || geoTiffMd.epsg,
                imageExtent: extent,
            });
            source.on('imageloadend', () => URL.revokeObjectURL(objectURL));
        }
        imageOverlay.setSource(source);
    }

    // Grab the extent from the GeoTIFF then read the raster for the current band(s).
    // Then bounce the band data into a canvas using a web worker.
    private async loadGeoTiffUsingWorkers(imageOverlay: ImageLayer<ImageStatic>, geoTiffMd: GeoTiffMetadata): Promise<LoadedGeoTiff> {
        let response: Response;
        try {
            const url = `${CustomLayerGroupFactory.geoTiffServerUrl}/${encodeURIComponent(geoTiffMd.filename)}`;
            response = await fetch(url);
            if (!response.ok) {
                throw new Error(`fetch ${url} failed with status ${response.status}: ${response.statusText}`);
            }
        } catch(ex) {
            console.error('Error while fetching GeoTIFF: ', ex);
            return {blob: null, extent: null};
        }

        let rmd: RasterMetadata;
        let extent: number[];
        try {
            const arrayBuffer: ArrayBuffer = await response.arrayBuffer();
            const tiff: GeoTIFF = await fromArrayBuffer(arrayBuffer);
            const image: GeoTIFFImage = await tiff.getImage();
            const width: number = image.getWidth();
            const height: number = image.getHeight();
            if (!geoTiffMd.cornerCoordinates) {
                extent = image.getBoundingBox();
            } else {
                extent = this.getExtentFromCornerCoordinates(geoTiffMd.cornerCoordinates, geoTiffMd.filename);
            }

            const opacity = geoTiffMd.displayOptions.opacity;
            const invert = geoTiffMd.displayOptions.invert;
            const alpha = (opacity <= 1 && opacity > 0) ? 255 * opacity :
                        ((opacity <= 255) ? opacity : 255);

            rmd = {
                raster: null,
                width:  width,
                height: height,
                isRGB:  geoTiffMd.isRGB,
                invert: invert,
                alpha:  alpha,
                bands:  geoTiffMd.bands,
                band:   geoTiffMd.band,
                chromaScale:    geoTiffMd.displayOptions.chromaScale,
                noDataValueRGB: geoTiffMd.noDataValueRGB,
            }

            this.debug && console.log(`Starting raster decode task for ${geoTiffMd.description}`)
            if (geoTiffMd.isRGB && geoTiffMd.bands.length >= 3) {
                if (!(isNaN(geoTiffMd.bands[0].displayMin) || isNaN(geoTiffMd.bands[0].displayMin) ||
                      isNaN(geoTiffMd.bands[1].displayMin) || isNaN(geoTiffMd.bands[1].displayMin) ||
                      isNaN(geoTiffMd.bands[2].displayMin) || isNaN(geoTiffMd.bands[2].displayMin))) {
                    // Scaled RGB
                    const rasters = await image.readRasters({
                        pool: this.geotiffDecoderPool.geotiffDecoderWorkerPool,
                        interleave: true,
                        samples: [0, 1, 2],
                    });
                    rmd.raster = rasters as TypedArrayWithDimensions;
                    this.geotiffDecoderPool.releasePoolReference();
                } else if (geoTiffMd.isRGB && geoTiffMd.bands.length >= 3) {
                    // Direct RGB
                    rmd.raster = await image.readRGB({
                        pool: this.geotiffDecoderPool.geotiffDecoderWorkerPool,
                    }) as TypedArrayWithDimensions;
                    this.geotiffDecoderPool.releasePoolReference();
                }
            }
            else {
                // Single Band
                const rasters = await image.readRasters({
                    pool: this.geotiffDecoderPool.geotiffDecoderWorkerPool,
                    interleave: false,
                    samples: [geoTiffMd.band.band - 1],
                });
                rmd.raster = rasters[0] as TypedArrayWithDimensions;
                this.geotiffDecoderPool.releasePoolReference();
            }
            this.debug && console.log(`Finished raster decode task for ${geoTiffMd.description}`)
        } catch(ex) {
            console.log('Error while reading GeoTIFF raster: ', ex);
            return {blob: null, extent: null};
        }

        try {
            this.debug && console.log(`Starting raster transformation task for ${geoTiffMd.description}.`)
            const readRasterTask = { taskData: rmd, transferables: [rmd.raster.buffer] };
            const blob: Blob = await this.rasterWorkerPool.queueTask(readRasterTask);
            this.debug && console.log(`Finished raster transformation task and acquired image Blob for ${geoTiffMd.description}.`)
            return {blob, extent}
        } catch(ex) {
            console.error('Error while decoding GeoTIFF raster: ', ex);
            return {blob: null, extent: null};
        }
    }
}
