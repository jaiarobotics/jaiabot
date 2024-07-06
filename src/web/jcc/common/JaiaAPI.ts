/* eslint-disable quote-props */
require("es6-promise").polyfill();
require("isomorphic-fetch");

import { GeoJSON } from "ol/format";
import { Command, Engineering, CommandForHub, TaskPacket } from "../../shared/JAIAProtobuf";
import { randomBase57, convertHTMLStrDateToISO } from "../client/components/shared/Utilities";
import { Geometry } from "ol/geom";
import { FeatureCollection } from "@turf/turf";

export interface JaiaError {
    code?: number;
    message?: string;
}

export type BotPathPoint = [utime: number, lon: number, lat: number];
export type BotPaths = { [key: string]: BotPathPoint[] };

export interface JaiaResponse<T> {
    error?: JaiaError;
    result?: T;
}

export class JaiaAPI {
    clientId: string;
    url: string;
    debug: boolean;
    headers: { [key: string]: string };

    constructor(clientId: string, url = "http://192.168.42.1:5000", debug = true) {
        this.clientId = clientId;
        console.debug(`JaiaAPI clientId = ${clientId}`);
        this.url = url;

        this.debug = debug;
        this.headers = {
            "Content-Type": "application/json; charset=utf-8",
            clientId: this.clientId,
        };
    }

    hit(method: string, endpoint: string, requestBody?: any) {
        if (this.debug) {
            console.log(`Request endpoint: ${method} ${this.url}${endpoint}`);
            console.log(`Request body: ${JSON.stringify(requestBody)}`);
        }
        return fetch(`${this.url}${endpoint}`, {
            method,
            headers: this.headers,
            body: JSON.stringify(requestBody),
        })
            .then(
                (response) => {
                    if (response.ok) {
                        try {
                            return response.json();
                        } catch (error) {
                            console.error("Error parsing response json");
                            console.error(error);
                            return response.text();
                        }
                    }
                    if (this.debug) {
                        console.error(
                            `Error from ${method} to JaiaAPI: ${response.status} ${response.statusText}`,
                        );
                    }
                    return Promise.reject(
                        new Error(
                            `Error from ${method} to JaiaAPI: ${response.status} ${response.statusText}`,
                        ),
                    );
                },
                (reason) => {
                    console.error(`Failed to ${method} JSON request: ${reason}`);
                    console.error("Request body:");
                    console.error(requestBody);
                    return Promise.reject(new Error("Response parse fail"));
                },
            )
            .then(
                (res) => {
                    if (this.debug) console.log(`JaiaAPI Response: ${res.code} ${res.msg}`);
                    return res;
                },
                (reason) => reason,
            );
    }

    post(endpoint: string, body?: any) {
        return this.hit("POST", endpoint, body);
    }

    get(endpoint: string) {
        return this.hit("GET", endpoint);
    }

    /**
     * Gets clientID provided by the server for the web session
     *
     * @returns {string} clientID provided by the server
     */
    getClientId() {
        return this.clientId;
    }

    getMetadata() {
        return this.get("jaia/metadata");
    }

    getStatus() {
        return this.get("jaia/status");
    }

    /**
     * Gets most recent status for hub(s)
     *
     * @returns {{[key: string]: PortalHubStatus}} Object containing most recent status for hub(s)
     */
    getStatusHubs() {
        return this.get("jaia/status-hubs");
    }

    getBotPaths(since_utime?: number): Promise<JaiaResponse<BotPaths>> {
        var url = "jaia/bot-paths";

        if (since_utime) {
            url += `?since-utime=${since_utime}`;
        }

        return this.get(url);
    }

    /**
     * Queries the server for TaskPackets within a specified range. If no start and end date, the
     * server defaults to a 14 hour window with the end date set to now
     *
     * @param {string} startDate (optional) sets the lower bound on the TaskPackets displayed
     * @param {string} endDate (optional) sets the upper bound on the TaskPackets displayed
     * @returns {Promise<TaskPacket[]>} array of TaskPackets or error obj
     *
     * @notes
     * Expected startDate format: yyyy-mm-dd hh:mm
     * Expected endDate format: yyyy-mm-dd hh:mm
     */
    getTaskPackets(startDate?: string, endDate?: string) {
        if (startDate && endDate) {
            const startDateStr = convertHTMLStrDateToISO(startDate);
            const endDateStr = convertHTMLStrDateToISO(endDate);
            return this.get(`jaia/task-packets?startDate=${startDateStr}&endDate=${endDateStr}`);
        } else if (startDate && !endDate) {
            const startDateStr = convertHTMLStrDateToISO(startDate);
            return this.get(`jaia/task-packets?startDate=${startDateStr}`);
        } else {
            // Let server set default date values
            return this.get(`jaia/task-packets`);
        }
    }

    getTaskPacketsCount() {
        return this.get(`jaia/task-packets-count`);
    }

    
    /**
     * Get a set of depth contours from the backend in GeoJSON format.
     *
     * @async
     * @param {?string} [startDate] sets the lower bound on the TaskPackets displayed
     * @param {?string} [endDate] sets the upper bound on the TaskPackets displayed
     * @returns {Promise<FeatureCollection<Geometry>>} The depth contour feature set.
     * @notes Expected startDate format: yyyy-mm-dd hh:mm Expected endDate format: yyyy-mm-dd hh:mm
     */
    async getDepthContours(
        startDate?: string,
        endDate?: string,
    ): Promise<FeatureCollection<Geometry>> {
        var queryParameters = [];
        if (startDate) {
            const startDateStr = convertHTMLStrDateToISO(startDate);
            queryParameters.push(`startDate=${startDateStr}`);
        }
        if (endDate) {
            const endDateStr = convertHTMLStrDateToISO(endDate);
            queryParameters.push(`endDate=${endDateStr}`);
        }

        if (queryParameters.length > 0) {
            const queryParameterString = queryParameters.join("&");
            return (await this.get(
                `jaia/depth-contours?${queryParameterString}`,
            )) as FeatureCollection<Geometry>;
        } else {
            // Let server set default date values
            return (await this.get(`jaia/depth-contours`)) as FeatureCollection<Geometry>;
        }
    }

    /**
     * Gets a GeoJSON object with interpolated drift features
     *
     * @param {string} startDate (optional) Set a lower bound on drift packets used for interpolation
     * @param {string} endDate (optional) Set an upper bound of drift packets used for interpolation
     *
     * @returns {Feature<Geometry>[] | void} A GeoJSON feature set containing interpolated drift features
     */
    getDriftMap(startDate?: string, endDate?: string) {
        var queryParameters = [];
        if (startDate) {
            const startDateStr = convertHTMLStrDateToISO(startDate);
            queryParameters.push(`startDate=${startDateStr}`);
        }
        if (endDate) {
            const endDateStr = convertHTMLStrDateToISO(endDate);
            queryParameters.push(`endDate=${endDateStr}`);
        }

        if (queryParameters.length > 0) {
            const queryParameterString = queryParameters.join("&");
            return this.get(`jaia/drift-map?${queryParameterString}`)
                .then((geoJSON) => {
                    const features = new GeoJSON().readFeatures(geoJSON);
                    return features;
                })
                .catch((err) => {
                    logResReqError("getDriftMap", err);
                });
        } else {
            // Let server set default date values
            return this.get(`jaia/drift-map`)
                .then((geoJSON) => {
                    const features = new GeoJSON().readFeatures(geoJSON);
                    return features;
                })
                .catch((err) => {
                    logResReqError("getDriftMap", err);
                });
        }
    }

    allStop() {
        return this.post("jaia/all-stop");
    }

    allActivate() {
        return this.post("jaia/all-activate", null);
    }

    nextTaskAll() {
        return this.post("jaia/next-task-all", null);
    }

    allRecover() {
        return this.post("jaia/all-recover", null);
    }

    postCommand(command: Command) {
        return this.post("jaia/command", command);
    }

    postCommandForHub(command: CommandForHub) {
        return this.post("jaia/command-for-hub", command);
    }

    postEngineeringPanel(engineeringPanelCommand: Engineering) {
        return this.post("jaia/ep-command", engineeringPanelCommand);
    }

    takeControl() {
        return this.post("jaia/take-control", null);
    }

    postEngineering(engineeringCommand: Engineering) {
        return this.post("jaia/engineering-command", engineeringCommand);
    }

    postMissionFilesCreate(descriptor: any) {
        return this.post("missionfiles/create", descriptor);
    }
}

/**
 * Combine console.error and console.log into one function to reduce code repetition
 *
 * @param {string} functionName Used as location input to the error msg to help debug
 * @param {Error} error Prints the error object to make all debug data visible
 * @returns {void}
 */
function logResReqError(functionName: string, error: Error) {
    console.error(`${functionName}:`, error);
    console.log(`${functionName}:`, error);
}

export const jaiaAPI = new JaiaAPI(randomBase57(22), "/", false);
