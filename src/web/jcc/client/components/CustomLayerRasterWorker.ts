/// <reference lib="webworker" />

import { TypedArrayWithDimensions } from 'geotiff';
import { Band } from './CustomLayers';

import chroma from 'chroma-js';

// Incomplete definitions in current TypeScript library?
declare global {
    interface OffscreenCanvas {
        convertToBlob(): Promise<Blob>;
    }
}

export interface RasterMetadata {
    raster: TypedArrayWithDimensions | null,
    width:  number,
    height: number,
    isRGB:  boolean,
    invert: boolean,
    alpha:  number,

    bands:  Band[],
    band:   Band,

    chromaScale:    string | null;
    noDataValueRGB: number[],
}

export interface RasterReadResult {
    blob: Blob | null,
    error: null | {
        message: string,
        filename: string,
        lineno: number,
        colno: number,
        error: {
            message: string | null,
            name: string | null,
            stack: string | null,
        }
    },
}

// Convert the raster from the geotiff NPM into a Blob representing the image.
// Supports RGB and single band (grayscale) rasters.
// Also supports Min/Max limits, pixel inversion, and gray-scale colorization.
async function rasterToBlob<Blob>(rmd: RasterMetadata) {
    const raster = rmd.raster;
    const canvas = new OffscreenCanvas(rmd.width, rmd.height);
    const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    const data: ImageData = context.createImageData(rmd.width, rmd.height);
    const rgb: Uint8ClampedArray = data.data;

    if (rmd.isRGB && rmd.bands.length >= 3) {
        let op = 0;
        const bands = rmd.bands;               // Shortened name makes the below code more readable
        const scale = bands.map(band => 255.0 / (band.displayMax - band.displayMin))
                           .map(scale => isNaN(scale) ? 1 : scale);
        const noRGBData = rmd.noDataValueRGB;  // Ditto
        for (let ip = 0; ip < raster.length; ip += 3) {
            rgb[op + 0] = raster[ip + 0] * scale[0];
            rgb[op + 1] = raster[ip + 1] * scale[1];
            rgb[op + 2] = raster[ip + 2] * scale[2];
            rgb[op + 3] = ((raster[ip + 0] == noRGBData?.[0] &&
                            raster[ip + 1] == noRGBData?.[1] &&
                            raster[ip + 2] == noRGBData?.[2])  ||
                        raster[ip + 0] == bands[0].noDataValue || (isNaN(raster[ip + 0]) && bands[0].noDataValue === 'NaN') ||
                        raster[ip + 1] == bands[1].noDataValue || (isNaN(raster[ip + 1]) && bands[1].noDataValue === 'NaN') ||
                        raster[ip + 2] == bands[2].noDataValue || (isNaN(raster[ip + 2]) && bands[2].noDataValue === 'NaN')) ? 0 : rmd.alpha;
            if (rmd.invert) {
                rgb[op + 0] = rgb[op + 0] ^ 255;
                rgb[op + 1] = rgb[op + 1] ^ 255;
                rgb[op + 2] = rgb[op + 2] ^ 255;
            }
            op += 4;
        }
    } else {
        const band = rmd.band;
        const displayMin = band.displayMin;
        const displayMax = band.displayMax;

        const scale = 255.0 / (displayMax - displayMin);
        const chromaScaleEffective = rmd.chromaScale && chroma.scale(rmd.chromaScale).mode('hsl');

        let op = 0;
        for (let ip = 0; ip < raster.length; ip++) {
            const rasterValue = raster[ip];
            const isNoData = (isNaN(rasterValue) && rmd.band.noDataValue === 'NaN' ||
                            rasterValue == rmd.band.noDataValue);
            let level = 0;
            if (!isNoData) {
                const limitedRasterValue = rasterValue > displayMax ? displayMax :
                                        rasterValue < displayMin ? displayMin : rasterValue;
                level = Math.round(isNoData ? 0 : (limitedRasterValue - displayMin) * scale);
            }
            if (rmd.invert) {
                level = level ^ 255;
            }
            if (!chromaScaleEffective) {
                rgb[op + 0] = level;
                rgb[op + 1] = level;
                rgb[op + 2] = level;
            } else {
                const levels = chromaScaleEffective(level / 255)              // Convert to color scale
                            .set('hsl.l', '*1.2').set('hsl.s', '*0.6').rgb(); // Make it pastel
                rgb[op + 0] = levels[0];
                rgb[op + 1] = levels[1];
                rgb[op + 2] = levels[2];
            }
            rgb[op + 3] = isNoData ? 0 : rmd.alpha;
            op += 4;
        }
    }
    context.putImageData(data, 0, 0);
    return await canvas.convertToBlob();
}

// Web worker interface
self.onmessage = async function(event: MessageEvent<RasterMetadata>) {
    try {
        const blob = await rasterToBlob(event.data);
        self.postMessage({ blob: blob });  // NB: a blob is not "Transferable", but it nonetheless
    }                                      // transfers quickly due to other mechanisms.
    catch (event) {
        self.postMessage({
            error: {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: {
                    message: event.error ? event.error.message : null,
                    name: event.error ? event.error.name : null,
                    stack: event.error ? event.error.stack : null
                },
            },
        });
    }
}