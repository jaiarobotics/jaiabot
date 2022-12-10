import { diveTask } from './Styles';
export interface Location {
    lon: number
    lat: number
}

export interface Task {
    type: string
}

export interface Goal {
    location: Location | undefined
    task?: Task
}


export interface Plan {
    goal: Array<Goal>
}


export interface Command {
    plan: Plan
}

// Task Packets

export interface DiveTask {
    depth_achieved: number
    bottom_dive?: boolean
    start_location?: Location
    duration_to_acquire_gps?: number
    powered_rise_rate?: number
    unpowered_rise_rate?: number
}

export function DiveTaskDescription(dive: DiveTask): Array<string> {
    var rows: Array<string> = [
        `Depth achieved: ${dive.depth_achieved.toFixed(2)} m`
    ]

    if (dive.duration_to_acquire_gps != null) {
        rows.push(`Duration to acquire GPS: ${dive.duration_to_acquire_gps.toFixed(2)} s`)
    }

    if (dive.powered_rise_rate != null) {
        rows.push(`Powered rise rate: ${dive.powered_rise_rate.toFixed(2)} m/s`)
    }

    if (dive.unpowered_rise_rate != null) {
        rows.push(`Unpowered rise rate: ${dive.unpowered_rise_rate.toFixed(2)} m/s`)
    }

    return rows
}

export interface DriftTask {
    start_location: Location
    end_location: Location
    drift_duration: number
}

export interface TaskPacket {
    drift?: DriftTask
    dive?: DiveTask
}
