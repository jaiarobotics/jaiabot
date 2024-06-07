const JSZip = require("jszip") as any; // No type definitions for this old version
import { KML } from "ol/format";
import { Type } from "ol/format/Feature";

// Create functions to extract KML and icons from KMZ array buffer, which must be done synchronously.
const zip = new JSZip();

function getKMLData(buffer: any) {
    let kmlData;
    zip.load(buffer);
    const kmlFile = zip.file(/\.kml$/i)[0];
    if (kmlFile) {
        kmlData = kmlFile.asText();
    }
    return kmlData;
}

function getKMLImage(href: string) {
    const index = window.location.href.lastIndexOf("/");
    if (index !== -1) {
        const kmlFile = zip.file(href.slice(index + 1));
        if (kmlFile) {
            return URL.createObjectURL(new Blob([kmlFile.asArrayBuffer()]));
        }
    }
    return href;
}

// Define a KMZ format class by subclassing ol/format/KML

export class KMZ extends KML {
    constructor(inputOptions: any) {
        const options = inputOptions || {};
        options.iconUrlFunction = getKMLImage;
        super(options);
    }

    getType() {
        return "arraybuffer" as Type;
    }

    readFeature(source: any, options: any) {
        const kmlData = getKMLData(source);
        return super.readFeature(kmlData, options);
    }

    readFeatures(source: any, options: any) {
        const kmlData = getKMLData(source);
        return super.readFeatures(kmlData, options);
    }
}
