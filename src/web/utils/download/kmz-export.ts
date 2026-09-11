import JSZip from "jszip";

import { DriftPacket, TaskPacket } from "../../shared/proto/jaiabot/messages/jaia_dccl";
import { timestampToISOString } from "../conversions";
import { DRIFT_INTENSITY_INTERVAL, MAX_DRIFT_INTENSITY } from "../constants";

import diveMarker from "./kmz-icons/dive-marker.png";
import driftArrow0 from "./kmz-icons/drift-arrow-0.png";
import driftArrow1 from "./kmz-icons/drift-arrow-1.png";
import driftArrow2 from "./kmz-icons/drift-arrow-2.png";
import driftArrow3 from "./kmz-icons/drift-arrow-3.png";
import driftArrow4 from "./kmz-icons/drift-arrow-4.png";
import driftArrow5 from "./kmz-icons/drift-arrow-5.png";

// We omit the file:// so that the KMZ can be opened properly in Google Earth
const DIVE_MARKER_URL = "files/dive-marker.png";

/**
 * Produces the path to the correct drift icon based on drift speed
 *
 * @param {DriftPacket} driftPacket Contains drift speed
 * @returns {string} Path to drift icon
 */
function getDriftArrow(driftPacket: DriftPacket) {
    let driftIntensity = Math.floor(driftPacket.estimated_drift.speed / DRIFT_INTENSITY_INTERVAL);
    driftIntensity = Math.min(driftIntensity, MAX_DRIFT_INTENSITY);
    return `${`files/drift-arrow-${driftIntensity}.png`}`;
}

/**
 * Produces a filename to use for the KMZ file of task packets. The filename includes
 * the date of the first task packet's start time.
 *
 * @param {TaskPacket[]} taskPackets Task packets to include in the KMZ file
 * @returns {string} A filename in the format `taskPackets-[date].kmz`
 */
export function getKMZFilename(taskPackets: TaskPacket[]) {
    const timestamp = taskPackets[0]?.start_time;
    const fileDate = timestamp ? timestampToISOString(Number(timestamp)) : new Date().toISOString();
    return `task-packets-${fileDate}.kmz`;
}

/**
 * Generates the KML code for a task packet
 *
 * @param {TaskPacket} taskPacket Task packet to process into KML placemarks
 * @returns {Promise<string[]>} A promise for an array of each KML placemark in a task packet
 */
function taskPacketToKMLPlacemarks(taskPacket: TaskPacket) {
    let placemarks = [];
    const formatter = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "medium",
    });

    let startTimeString = "N/A";
    if (taskPacket.start_time) {
        const startTime = new Date(Number(taskPacket.start_time) / 1e3);
        startTimeString = formatter.format(startTime);
    }

    const dive = taskPacket.dive;
    if (dive && dive.depth_achieved !== 0) {
        const depthString = `${dive.depth_achieved.toFixed(2)} m`;
        let depthMeasurements = ``;
        for (let i = 0; i < dive.measurement.length; i++) {
            depthMeasurements += `
                Index: ${i + 1} <br />
                Mean-Depth: ${dive.measurement.at(i)?.mean_depth?.toFixed(2)} m <br />
                Mean-Temperature: ${dive.measurement.at(i)?.mean_temperature?.toFixed(2)} Celsius <br />
                Mean-Salinity: ${dive.measurement?.at(i)?.mean_salinity?.toFixed(2)} PSS <br />
            `;
        }

        placemarks.push(`
            <Placemark>
                <name>${depthString}</name>
                <description>
                    <h2>Dive</h2>
                    Bot-ID: ${taskPacket.bot_id}<br />
                    Start: ${startTimeString}<br />
                    Depth: ${depthString}<br />
                    Bottom-Dive: ${dive.bottom_dive ? "Yes" : "No"}<br />
                    Duration-to-GPS: ${dive.duration_to_acquire_gps.toFixed(2)} s<br />
                    Unpowered-Rise-Rate: ${dive?.unpowered_rise_rate?.toFixed(2)} m/s<br />
                    Powered-Rise-Rate: ${dive?.powered_rise_rate?.toFixed(2)} m/s<br />
                    Bottom-Type: ${dive.bottom_type} <br />
                    ${depthMeasurements}
                </description>
                <Point>
                    <coordinates>${dive.start_location.lon},${dive.start_location.lat}</coordinates>
                </Point>
                <Style>
                    <IconStyle id="mystyle">
                    <Icon>
                        <href>${DIVE_MARKER_URL}</href>
                        <scale>0.5</scale>
                    </Icon>
                    </IconStyle>
                </Style>
            </Placemark>
        `);
    }

    const drift = taskPacket.drift;
    if (drift && drift.drift_duration !== 0) {
        const speedString = `${drift.estimated_drift.speed.toFixed(2)} m/s`;
        const heading = drift.estimated_drift.heading ?? 0.0;

        const driftDescription = `
            <h2>Drift</h2>
            Bot-ID: ${taskPacket.bot_id}<br />
            Start: ${startTimeString}<br />
            Duration: ${drift.drift_duration} s<br />
            Speed: ${speedString}<br />
            Heading: ${drift.estimated_drift.heading.toFixed(2)} deg<br />
            Significant-Wave-Height: ${drift.significant_wave_height.toFixed(2)} m<br />
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
                        <href>${getDriftArrow(drift)}</href>
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
 * Returns a KML string representing the KML document
 *
 * @returns {Promise<string>} the KML document as a string
 */
function getKML(taskPackets: TaskPacket[]) {
    let placemarks = "";

    for (const taskPacket of taskPackets) {
        const taskPacketKML = taskPacketToKMLPlacemarks(taskPacket);
        placemarks += taskPacketKML;
    }

    return `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/kml/2.2 https://developers.google.com/kml/schema/kml22gx.xsd">
            <Document>
                ${placemarks}
            </Document>
        </kml>`;
}

/**
 * Returns a Blob representing the KML document as a KMZ file
 *
 * @returns {Promise<Blob>} A promise for a Blob containing the KMZ file
 */
export async function getKMZ(taskPackets: TaskPacket[]) {
    const kml = getKML(taskPackets);
    const zip = new JSZip();
    zip.file("doc.kml", kml);

    const filesFolder = zip.folder("files");
    const diveMarkerBlob = await fetch(diveMarker).then((res) => res.blob());
    filesFolder.file("dive-marker.png", diveMarkerBlob);

    const driftArrows = [
        driftArrow0,
        driftArrow1,
        driftArrow2,
        driftArrow3,
        driftArrow4,
        driftArrow5,
    ];

    for (let index = 0; index < driftArrows.length; index++) {
        const driftArrowBlob = await fetch(driftArrows[index]).then((res) => res.blob());
        filesFolder.file(`drift-arrow-${index}.png`, driftArrowBlob);
    }

    return await zip.generateAsync({ type: "blob" });
}
