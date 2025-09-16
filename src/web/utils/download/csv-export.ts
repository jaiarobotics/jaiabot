import { TaskPacket } from "../../types/protobuf-types";

/**
 * Converts a Unix timestamp (microseconds) to an ISO date string
 *
 * @param {number} tMicroseconds Unix timestamp in microseconds since Unix epoch
 * @returns {string} Date string in ISO date format
 */
function getISOString(tMicroseconds: number) {
    if (!tMicroseconds) {
        return "";
    }

    return new Date(tMicroseconds / 1000).toISOString();
}

/**
 * Produces a filename to use for the CSV file of task packets. The filename includes
 * the date of the first task packet's start time.
 *
 * @param {TaskPacket[]} taskPackets Task packets to include in the CSV file
 * @returns {string} A filename in the format `taskPackets-[date].csv`
 */
export function getCSVFilename(taskPackets: TaskPacket[]) {
    const fileDate = taskPackets[0]?.start_time;
    const fileDateString = fileDate ? getISOString(fileDate) : new Date().toISOString();
    return `taskPackets-${fileDateString}.csv`;
}

/**
 * Converts an array of task packets into a CSV file
 *
 * @param {TaskPacket[]} taskPackets Included in CSV file
 * @returns {string} CSV file contents as a string
 */
export async function getCSV(taskPackets: TaskPacket[]) {
    let csvText =
        "id,bot,task,lat,lon,time,bottom dive,depth achieved (m),current strength (m/s),current heading (deg),(beta) significant wave height (m)\n";
    let id = 0;

    for (const taskPacket of taskPackets) {
        const startLocation = taskPacket.dive?.start_location ?? taskPacket.drift?.start_location;
        const row: string[] = [
            id.toString(),
            taskPacket.bot_id?.toString() ?? "",
            taskPacket.type.toString() ?? "",
            startLocation.lat?.toString() ?? "",
            startLocation.lon?.toString() ?? "",
            getISOString(taskPacket.start_time),
            String(taskPacket.dive?.bottom_dive ?? false),
            taskPacket.dive?.depth_achieved?.toFixed(3) ?? "",
            taskPacket.drift?.estimated_drift?.speed?.toFixed(3) ?? "",
            taskPacket.drift?.estimated_drift?.heading?.toFixed(3) ?? "",
            taskPacket.drift?.significant_wave_height?.toFixed(3) ?? "",
        ];

        csvText += row.join(",") + "\n";

        id += 1;
    }

    return csvText;
}
