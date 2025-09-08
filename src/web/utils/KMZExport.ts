import JSZip from "jszip";

import { LogTaskPacket } from "./LogMessages";
import { DriftPacket, TaskPacket } from "../types/protobuf-types";
import bottomStrikeSvg from "../style/icons/bottomStrike.svg";
import driftArrow1 from "../style/icons/drift-arrows/drift-arrow-1.svg";
import driftArrow2 from "../style/icons/drift-arrows/drift-arrow-2.svg";
import driftArrow3 from "../style/icons/drift-arrows/drift-arrow-3.svg";
import driftArrow4 from "../style/icons/drift-arrows/drift-arrow-4.svg";
import driftArrow5 from "../style/icons/drift-arrows/drift-arrow-5.svg";
import driftArrow6 from "../style/icons/drift-arrows/drift-arrow-6.svg";
/**
 * Generates the KML code for each feature in a task packet
 *
 * @param {TaskPacket | LogTaskPacket} taskPacket The task packet to process into KML features
 * @returns {Promise<string[]>} A promise for an array of strings for each KML feature in `taskPacket`
 */
async function taskPacketToKMLPlacemarks(taskPacket: TaskPacket | LogTaskPacket) {
    let placemarks = [];

    if ("_scheme_" in taskPacket && taskPacket._scheme_ !== 1) {
        return [];
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
    });

    let startTimeString = "Unknown";
    if (taskPacket.start_time !== undefined) {
        const startTime = new Date(taskPacket.start_time / 1e3);
        startTimeString = formatter.format(startTime);
    }

    const bot_id = taskPacket.bot_id;

    // We omit the file:// here, so that the KMZ can be opened properly in Google Earth
    const diveIconUrl = "files/diveIcon.png";

    /**
     * Returns the drift icon index that should be displayed, given a drift speed.
     *
     * @param {number} driftSpeed Speed of the drift, in m/s
     * @returns {number} Index into Styles.driftArrowPngs, of the icon sthat should represent this drift
     */
    function driftSpeedToBinIndex(driftSpeed: number) {
        // 6 bins for drift speeds of 0 m/s to 2.5+ m/s
        // Bin numbers (+ 1) correspond with the number of tick marks on the drift arrow visually indicating the speed of the drift to the operator
        if (driftSpeed == null) return 0;

        const binValueIncrement = 0.5;
        return Math.floor(driftSpeed / binValueIncrement);
    }
    /**
     * Returns the path to the appropriate embedded drift arrow icon PNG file
     *
     * @param {DriftPacket} drift packet whose speed will be used to find the appropriate icon
     * @returns {string} path to the embedded drift arrow icon file
     */
    function getDriftArrowHeadUrl(drift: DriftPacket) {
        const driftArrowIndex = driftSpeedToBinIndex(drift.estimated_drift?.speed ?? 0.0);
        return `files/drift-arrow-${driftArrowIndex}.png`;
    }

    const dive = taskPacket.dive;
    if (dive != null && dive.depth_achieved != 0) {
        const depthString = `${dive.depth_achieved.toFixed(2)} m`;
        let depthMeasurementString = ``;

        for (let i = 0; i < dive.measurement?.length; i++) {
            depthMeasurementString += `
                    Index: ${i + 1} <br />
                    Mean-Depth: ${dive.measurement?.at(i)?.mean_depth?.toFixed(2)} m <br />
                    Mean-Temperature: ${dive.measurement?.at(i)?.mean_temperature?.toFixed(2)} Celsius <br />
                    Mean-Salinity: ${dive.measurement?.at(i)?.mean_salinity?.toFixed(2)} PSS <br />
                `;
        }

        placemarks.push(`
            <Placemark>
                <name>${depthString}</name>
                <description>
                    <h2>Dive</h2>
                    Bot-ID: ${bot_id}<br />
                    Start: ${startTimeString}<br />
                    Depth: ${depthString}<br />
                    Bottom-Dive: ${dive.bottom_dive ? "Yes" : "No"}<br />
                    Duration-to-GPS: ${dive.duration_to_acquire_gps?.toFixed(2)} s<br />
                    Unpowered-Rise-Rate: ${dive.unpowered_rise_rate?.toFixed(2)} m/s<br />
                    Powered-Rise-Rate: ${dive.powered_rise_rate?.toFixed(2)} m/s<br />
                    Bottom-Type: ${dive.bottom_type} <br />
                    ${depthMeasurementString}
                </description>
                <Point>
                    <coordinates>${dive.start_location.lon},${dive.start_location.lat}</coordinates>
                </Point>
                <Style>
                    <IconStyle id="mystyle">
                    <Icon>
                        <href>${diveIconUrl}</href>
                        <scale>0.5</scale>
                    </Icon>
                    </IconStyle>
                </Style>
            </Placemark>
        `);
    }

    const drift = taskPacket.drift;
    if (drift != null && drift.drift_duration != 0) {
        const DEG = Math.PI / 180.0;
        const speedString = `${drift.estimated_drift.speed?.toFixed(2)} m/s`;
        const heading = drift.estimated_drift.heading ?? 0.0;
        const driftArrowIndex = driftSpeedToBinIndex(drift.estimated_drift.speed) ?? 0;

        const driftDescription = `
            <h2>Drift</h2>
            Bot-ID: ${bot_id}<br />
            Start: ${startTimeString}<br />
            Duration: ${drift.drift_duration} s<br />
            Speed: ${speedString}<br />
            Heading: ${drift.estimated_drift.heading?.toFixed(2)} deg<br />
            Significant-Wave-Height: ${drift.significant_wave_height?.toFixed(2)} m<br />
            Wave-Period: N/A<br />
        `;

        placemarks.push(`
        <Placemark>
            <name>${speedString}</name>
            <description>
                ${driftDescription}
            </description>
            <Point>
                <coordinates>${drift.end_location.lon},${drift.end_location.lat}</coordinates>
            </Point>
            <Style id="driftArrowHead">
                <IconStyle>
                    <scale>1.0</scale>                   <!-- float -->
                    <heading>${heading}</heading>               <!-- float -->
                    <Icon>
                        <href>${getDriftArrowHeadUrl(drift)}</href>
                    </Icon>
                    <hotSpot x="0.5"  y="0.5"
                        xunits="fraction" yunits="fraction"/>    <!-- kml:vec2 -->
                </IconStyle>
            </Style>
        </Placemark>
        `);
    }

    return placemarks;
}

/**
 * A KML/KMZ document
 *
 * @class KMLDocument
 * @typedef {KMLDocument}
 */
export class KMLDocument {
    #taskPackets: (TaskPacket | LogTaskPacket)[];

    constructor() {
        this.#taskPackets = [];
    }

    /**
     * Sets the task packets for the KML document
     *
     * @param {(TaskPacket | LogTaskPacket)[]} taskPackets Task packets to be used in KML document
     * @returns {void}
     */
    setTaskPackets(taskPackets: (TaskPacket | LogTaskPacket)[]) {
        this.#taskPackets = taskPackets;
    }

    /**
     * Gets the array of task packets used in the KML
     *
     * @returns {(TaskPacket | LogTaskPacket)[]} The array of task packets used in the KML
     */
    getTaskPackets() {
        return this.#taskPackets;
    }

    /**
     * Returns a KML string representing the KML document
     *
     * @returns {Promise<string>} the KML document as a string
     */
    async getKML() {
        let placemarksKML = "";

        for (const taskPacket of this.#taskPackets) {
            const taskPacketKML = await taskPacketToKMLPlacemarks(taskPacket);
            placemarksKML += taskPacketKML;
        }

        return `
            <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/kml/2.2 https://developers.google.com/kml/schema/kml22gx.xsd">
                <Document>
                    ${placemarksKML}
                </Document>
            </kml>
            `;
    }

    /**
     * Returns a Blob representing the KML document as a KMZ file
     *
     * @returns {Promise<Blob>} A promise for a Blob containing the KMZ file
     */
    async getKMZ() {
        const kmlFileString = await this.getKML();

        var zip = new JSZip();
        zip.file("doc.kml", kmlFileString);

        var filesFolder = zip.folder("files");

        const diveIconBlob = await fetch(bottomStrikeSvg).then((r) => r.blob());
        filesFolder.file("diveIcon.png", diveIconBlob);

        const driftArrowSvgs = [
            driftArrow1,
            driftArrow2,
            driftArrow3,
            driftArrow4,
            driftArrow5,
            driftArrow6,
        ];

        for (let index = 0; index < driftArrowSvgs.length; index++) {
            const driftArrowBlob = await fetch(driftArrowSvgs[index]).then((r) => r.blob());
            filesFolder.file(`drift-arrow-${index}.svg`, driftArrowBlob);
        }

        return await zip.generateAsync({ type: "blob" });
    }
}
