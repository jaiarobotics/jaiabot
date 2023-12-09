import {TaskPacket} from './JAIAProtobuf'
import {LogTaskPacket} from './LogMessages'

function isoString(t_micros: number | undefined): string {
    if (t_micros == null) {
        return ''
    }

    return new Date(t_micros / 1000).toISOString()
}

export async function getCSV(taskPackets: (TaskPacket | LogTaskPacket)[]) {
    var csvText = 'id,bot,task,lat,lon,time,bottom dive,depth achieved (m),current strength (m/s),current heading (deg)\n'
    var id = 0

    for (const taskPacket of taskPackets) {
        if ('_scheme_' in taskPacket) {
            if (taskPacket._scheme_ != 1) {
                // Skip DCCL messages
                continue
            }
        }

        const start_location = taskPacket.dive?.start_location ?? taskPacket.drift?.start_location

        const rowData: string[] = [
            id.toString(),
            taskPacket.bot_id?.toString() ?? '',
            taskPacket.type.toString() ?? '',
            start_location.lat?.toString() ?? '',
            start_location.lon?.toString() ?? '',
            isoString(taskPacket.start_time),
            String(taskPacket.dive?.bottom_dive ?? false),
            taskPacket.dive?.depth_achieved?.toFixed(3) ?? '',
            taskPacket.drift?.estimated_drift?.speed?.toFixed(3) ?? '',
            taskPacket.drift?.estimated_drift?.heading?.toFixed(3) ?? ''
        ]

        csvText += rowData.join(',') + '\n'

        id += 1
    }

    return csvText
}

export function getCSVFilename(taskPackets: TaskPacket[]) {
    const fileDate = taskPackets[0]?.start_time
    const fileDateString = fileDate ? isoString(fileDate) : new Date().toISOString()
    return `taskPackets-${fileDateString}.csv`
}
