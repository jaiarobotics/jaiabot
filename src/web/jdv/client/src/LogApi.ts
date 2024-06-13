import { LogCommand, LogTaskPacket } from "./shared/LogMessages";
import { Log } from "./Log";
import download from "downloadjs";
import { Plot } from "./Plot";
import { GeoJSONFeatureCollection } from "ol/format/GeoJSON";

export type ActiveGoals = {
    [key: string]: {
        _utime_: number;
        active_goal: number;
    }[];
};

export interface ConvertStatus {
    done: boolean;
}

/**
 * Initiates a browser download of the given URL, with filename and mimeType
 *
 * @param {string} url URL of the target
 * @param {string} [filename='filename'] Default filename to save the URL as
 * @param {string} [mimeType='text/plain'] MIME type of the content
 * @returns {Promise<void>} A Promise for the fetch operation
 */
function downloadURL(url: string, filename: string = "filename", mimeType: string = "text/plain") {
    return fetch(url, { method: "GET" })
        .then((res) => {
            return res.blob();
        })
        .then((blob) => {
            download(blob, filename, mimeType);
        });
}

/**
 * Response for the GET logs endpoint
 *
 * @interface GetLogsResponse
 * @typedef {GetLogsResponse}
 */
interface GetLogsResponse {
    availableSpace: number;
    logs: Log[];
}

export class LogApi {
    /**
     * Perform GET request
     *
     * @param {string} url URL of the endpoint
     * @returns {Promise<any>} A Promise of the JSON-decoded object
     */
    static async getJSON(url: string) {
        var request = new Request(url, {
            method: "GET",
            headers: new Headers({ "Content-Type": "application/json" }),
        });

        return fetch(request)
            .then((resp) => resp.json())
            .then((response_object) => {
                // If there's an error message in there, we need to throw it
                if (response_object.error != null) {
                    throw new Error(response_object.error);
                } else {
                    return response_object;
                }
            })
            .catch((err) => {
                console.error(err);
            });
    }

    /**
     * Download a GET request
     *
     * @param {string} url URL to download
     * @returns {Promise<void>} Promise for the download
     */
    static downloadFile(url: string) {
        return fetch(url, { method: "GET" })
            .then((res) => res.blob())
            .then((blob) => {
                var file = window.URL.createObjectURL(blob);
                window.location.assign(file);
            });
    }

    /**
     * Do a POST request with a JSON payload
     *
     * @param {string} url URL of endpoint
     * @param {object} payload Object to send as JSON payload
     * @returns {Promise<any>} Promise for the JSON-decoded response body
     */
    static post(url: string, payload: object) {
        var request = new Request(url, {
            method: "POST",
            headers: new Headers({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
        });

        return fetch(request)
            .then((resp) => resp.json())
            .then((response_object) => {
                // If there's an error message in there, we need to throw it
                if (response_object.error != null) {
                    throw new Error(response_object.error);
                } else {
                    return response_object;
                }
            })
            .catch((err) => {
                console.error(err);
            });
    }

    /**
     * Get a series corresponding to a set of log files and paths
     *
     * @param {string[]} logs Array of log names
     * @param {string[]} paths Comma-separate list of HDF paths to return
     * @returns {Promise<Plot[]>} Promise of an array of Plot objects
     */
    static getSeries(logs: string[], paths: string[]) {
        var url = new URL("series", window.location.origin);
        url.searchParams.append("log", logs.join(","));
        url.searchParams.append("path", paths.join(","));

        return this.getJSON(url.toString()) as Promise<Plot[]>;
    }

    /**
     * Get a list of all the available logs
     *
     * @returns {Promise<Log[]>} Promise of an array of Log objects
     */
    static getLogs(): Promise<Log[]> {
        return this.getJSON("/logs") as Promise<Log[]>;
    }

    // Gets all of the logs and associated metadata for each
    static get_logs(): Promise<GetLogsResponse> {
        return this.getJSON("/logs");
    }

    /**
     * Get a list of the paths present in a set of logs
     *
     * @param {string[]} logs Array of log names
     * @param {string} root_path Path of the root path to look for child paths
     * @returns {Promise<string[]>}
     */
    static getPaths(logs: string[], root_path: string) {
        var url = new URL("paths", window.location.origin);
        url.searchParams.append("log", logs.join(","));
        url.searchParams.append("root_path", root_path);

        return this.getJSON(url.toString()) as Promise<string[]>;
    }

    /**
     * Get a list of map path data
     *
     * @param {string[]} logs Array of log names
     * @returns {Pomise<MapData>}
     */
    static getMapData(logs: string[]) {
        var url = new URL("map", window.location.origin);
        url.searchParams.append("log", logs.join(","));

        type MapData = {
            [key: number]: number[][];
        };

        return this.getJSON(url.toString()) as Promise<MapData>;
    }

    /**
     * Get a list of the commands in a set of logs
     *
     * @param {string[]} logs Array of log names
     * @returns {Promise<LogCommand>} Promise of an array of LogCommands
     */
    static getCommands(logs: string[]) {
        var url = new URL("commands", window.location.origin);
        url.searchParams.append("log", logs.join(","));

        type LogCommands = {
            [key: string]: LogCommand[];
        };

        return this.getJSON(url.toString()) as Promise<LogCommands>;
    }

    /**
     * Get a list of the active goals in a set of logs
     *
     * @param {string[]} logs Array of log names
     * @returns {Promise<ActiveGoals>} Promise of an ActiveGoals object
     */
    static async getActiveGoal(logs: string[]): Promise<ActiveGoals> {
        var url = new URL("active-goal", window.location.origin);
        url.searchParams.append("log", logs.join(","));

        return (await this.getJSON(url.toString())) as ActiveGoals;
    }

    /**
     * Get a list of task packets in a set of logs
     *
     * @param {string[]} logs Array of log names
     * @returns {Promise<LogTaskPacket[]>} An array of task packets
     */
    static async getTaskPackets(logs: string[]) {
        var url = new URL("task-packet", window.location.origin);
        url.searchParams.append("log", logs.join(","));

        return (await this.getJSON(url.toString())) as LogTaskPacket[];
    }

    /**
     * Gets a GeoJSON object for the computed depth contours
     *
     * @param {string[]} logs Array of log names
     * @returns {Promise<GeoJSONFeatureCollection>} A GeoJSON feature collection with the computed depth contours
     */
    static async getDepthContours(logs: string[]) {
        var url = new URL("depth-contours", window.location.origin);
        url.searchParams.append("log", logs.join(","));

        return (await this.getJSON(url.toString())) as GeoJSONFeatureCollection;
    }

    /**
     * Gets a GeoJSON object for the computed interpolated drifts
     *
     * @param {string[]} logs Array of log names
     * @returns {Promise<GeoJSONFeatureCollection>} A GeoJSON feature collection with the interpolated drifts
     */
    static async getDriftInterpolations(logs: string[]) {
        var url = new URL("interpolated-drifts", window.location.origin);
        url.searchParams.append("log", logs.join(","));

        return (await this.getJSON(url.toString())) as GeoJSONFeatureCollection;
    }

    /**
     * Deletes a log
     *
     * @param {string} logName Name of the log to delete
     * @returns {Promise<Response>} Response of the DELETE request
     */
    static async deleteLog(logName: string) {
        const request = new Request(`/log/${logName}`, { method: "DELETE" });
        return fetch(request);
    }

    /**
     * Download MOOS messages as a CSV file
     *
     * @param {string[]} logs Array of log names
     * @param {number[]} time_range
     * @returns {Promise<void>} Promise of the request
     */
    static async getMOOS(logs: string[], time_range: number[]) {
        var url = new URL("moos", window.location.origin);
        url.searchParams.append("log", logs.join(","));
        url.searchParams.append("t_start", String(time_range[0]));
        url.searchParams.append("t_end", String(time_range[1]));

        return downloadURL(url.toString(), "moos.csv", "text/csv");
    }

    /**
     * Initiates a conversion from .goby to .h5 on the backend, if necessary, and responds with the conversion status
     *
     * @param {string[]} logs Array of log names
     * @returns {Promise<ConvertStatus>} The status of the conversion operation
     */
    static async postConvertIfNeeded(logs: string[]) {
        return (await this.post("convert-if-needed", logs)) as ConvertStatus;
    }
}
