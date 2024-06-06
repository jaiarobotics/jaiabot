import { TaskPacket } from "./JAIAProtobuf";
import { LogTaskPacket } from "./LogMessages";

/**
 * Converts a Unix timestamp (microseconds) to an ISO date string.
 *
 * @param {(number | undefined)} tMicroseconds Unix timestamp in microseconds
 * since Unix epoch.
 * @returns {string} Date string in ISO date format.
 */
function isoString(tMicroseconds: number | undefined): string {
    if (tMicroseconds == null) {
        return "";
    }

    return new Date(tMicroseconds / 1000).toISOString();
}

/**
 * Converts an array of task packets into the CSV file format as a string.
 *
 * @param {(TaskPacket | LogTaskPacket)[]} taskPackets The task packets to
 * include in the CSV file.
 * @returns {string} The CSV file contents as a string.
 */
export async function getCSV(taskPackets: (TaskPacket | LogTaskPacket)[]) {
    let csvText =
        "id,bot,task,lat,lon,time,bottom dive,depth achieved (m),current strength (m/s),current heading (deg),(beta) significant wave height (m)\n";
    let id = 0;

    for (const taskPacket of taskPackets) {
        if ("_scheme_" in taskPacket) {
            if (taskPacket._scheme_ !== 1) {
                // Skip DCCL messages
                continue;
            }
        }

        const startLocation = taskPacket.dive?.start_location ?? taskPacket.drift?.start_location;

        const rowData: string[] = [
            id.toString(),
            taskPacket.bot_id?.toString() ?? "",
            taskPacket.type.toString() ?? "",
            startLocation.lat?.toString() ?? "",
            startLocation.lon?.toString() ?? "",
            isoString(taskPacket.start_time),
            String(taskPacket.dive?.bottom_dive ?? false),
            taskPacket.dive?.depth_achieved?.toFixed(3) ?? "",
            taskPacket.drift?.estimated_drift?.speed?.toFixed(3) ?? "",
            taskPacket.drift?.estimated_drift?.heading?.toFixed(3) ?? "",
            taskPacket.drift?.significant_wave_height?.toFixed(3) ?? "",
        ];

        csvText += rowData.join(",") + "\n";

        id += 1;
    }

    return csvText;
}

/**
 * Returns a filename to use for the task packet CSV file.  The filename includes
 * the date of the first task packet's start time.
 *
 * @param {TaskPacket[]} taskPackets The task packets to
 * include in the CSV file.
 * @returns {string} A filename in the format `taskPackets-[date].csv`.
 */
export function getCSVFilename(taskPackets: TaskPacket[]) {
    const fileDate = taskPackets[0]?.start_time;
    const fileDateString = fileDate ? isoString(fileDate) : new Date().toISOString();
    return `taskPackets-${fileDateString}.csv`;
}
