import { LogTaskPacket } from "./Log"
import JSZip from 'jszip';
import * as Styles from './shared/Styles'
import { DriftPacket } from "./shared/JAIAProtobuf";


function blobToDataUrl(blob: Blob): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            console.log(reader.result)
            resolve(reader.result)
        }
        reader.onerror = () => {                
            reject('Cannot convert blob to base64 string')
        }
        reader.readAsDataURL(blob)
    })
}


async function getDataUrl(url: string) {
    const response = await fetch(url)
    const blob = await response.blob()
    return await blobToDataUrl(blob)
}


/**
 * Returns an array of strings, containing the KML code for each feature in a task packet
 * @date 11/14/2023 - 3:16:59 PM
 *
 * @async
 * @param {LogTaskPacket} taskPacket The task packet to process into KML features
 * @returns {Promise<string[]>} A promise for the array of strings for each KML feature in `taskPacket`
 */
async function taskPacketToKMLPlacemarks(taskPacket: LogTaskPacket) {
    var placemarks: string[] = []

    if (taskPacket._scheme_ != 1) {
        return []
    }

    const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: "medium", timeStyle: "medium" })
    const date = new Date(taskPacket._utime_ / 1e3)
    const dateString = formatter.format(date)
    const bot_id = taskPacket.bot_id

    // We omit the file:// here, so that the KMZ can be opened properly in Google Earth
    const diveIconUrl = 'files/diveIcon.png'

    
    /**
     * Returns the path to the appropriate embedded drift arrow icon PNG file
     * @date 11/14/2023 - 3:14:28 PM
     *
     * @param {DriftPacket} drift packet whose speed will be used to find the appropriate icon
     * @returns {string} path to the embedded drift arrow icon file
     */
    function getDriftArrowHeadUrl(drift: DriftPacket) {
        const driftArrowIndex = Styles.driftSpeedToBinIndex(drift.estimated_drift?.speed ?? 0.0)
        return `files/drift-arrow-${driftArrowIndex}.png`
    }

    const dive = taskPacket.dive
    if (dive != null && dive.depth_achieved != 0) {
        const depthString = `${dive.depth_achieved.toFixed(2)} m`
        let depthMeasurementString = ``; 

        for (let i = 0; i < dive.measurement?.length; i++)
        {
            depthMeasurementString += 
                `
                    Index: ${i+1} <br />
                    Mean-Depth: ${dive.measurement?.at(i)?.mean_depth?.toFixed(2)} m <br />
                    Mean-Temperature: ${dive.measurement?.at(i)?.mean_temperature?.toFixed(2)} Celsius <br />
                    Mean-Salinity: ${dive.measurement?.at(i)?.mean_salinity?.toFixed(2)} PSS <br />
                `
        }

        placemarks.push(`
            <Placemark>
                <name>${depthString}</name>
                <description>
                    <h2>Dive</h2>
                    Bot-ID: ${bot_id}<br />
                    Time: ${dateString}<br />
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
        `)
    }

    const drift = taskPacket.drift
    if (drift != null && drift.drift_duration != 0) {

        const DEG = Math.PI / 180.0
        const speedString = `${drift.estimated_drift.speed?.toFixed(2)} m/s`
        const heading = drift.estimated_drift.heading ?? 0.0
        const driftArrowIndex = Styles.driftSpeedToBinIndex(drift.estimated_drift.speed) ?? 0

        const driftDescription = `
            <h2>Drift</h2>
            Bot-ID: ${bot_id}<br />
            Start: ${dateString}<br />
            Duration: ${drift.drift_duration} s<br />
            Speed: ${speedString}<br />
            Heading: ${drift.estimated_drift.heading?.toFixed(2)} deg<br />
            Significant-Wave-Height: ${drift.significant_wave_height?.toFixed(2)} m<br />
            Wave-Period: N/A<br />
        `

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
        `)
    }

    return placemarks
}


export class KMLDocument {
    task_packets: LogTaskPacket[] = []

    constructor() {
    }

    async getKML() {
        var placemarksKml = ''

        for (const task_packet of this.task_packets) {
            const taskPacketKml = await taskPacketToKMLPlacemarks(task_packet)
            placemarksKml += taskPacketKml
        }

        return `
        <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/kml/2.2 https://developers.google.com/kml/schema/kml22gx.xsd">
            <Document>
                ${placemarksKml}
            </Document>
        </kml>
        `
    }

    
    /**
     * Returns a Blob representing the KML document as a KMZ file
     *
     * @async
     * @returns {Promise<Blob>} A promise for a Blob containing the KMZ file
     */
    async getKMZ() {
        const kmlFileString = await this.getKML()

        var zip = new JSZip()
        zip.file("doc.kml", kmlFileString)
    
        var filesFolder = zip.folder("files")
        
        const diveIconBlob = await fetch(Styles.bottomStrikePng).then(r => r.blob())
        filesFolder.file('diveIcon.png', diveIconBlob)
        
        for (let index = 0; index < Styles.driftArrowPngs.length; index++) {
            const driftArrowBlob = await fetch(Styles.driftArrowPngs[index]).then(r => r.blob())
            filesFolder.file(`drift-arrow-${index}.png`, driftArrowBlob)
        }
        
        return await zip.generateAsync({type:"blob"})
    }

}
