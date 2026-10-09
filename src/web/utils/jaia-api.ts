import { GeoJSON } from "ol/format";
import { Engineering } from "@proto/jaiabot/messages/engineering";
import { Command, CommandForHub, TaskPacket } from "@proto/jaiabot/messages/jaia_dccl";
import { randomBase57, convertHTMLStrDateToISO } from "../shared/Utilities";
import { FeatureCollection, Geometry } from "geojson";

export interface JaiaError {
    code?: number;
    message?: string;
}

export type TaskPackets = { included: TaskPacket[]; excluded: TaskPacket[] };

export interface JaiaResponse<T> {
    error?: JaiaError;
    result?: T;
}

export interface Tileset {
    name: string;
    size: number;
    tile_count: number;
}

export interface MapsDirectory {
    maps: Tileset[];
    available_disk_bytes: number;
    total_disk_bytes: number;
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

    delete(endpoint: string) {
        return this.hit("DELETE", endpoint);
    }

    /**
     * Gets clientID provided by the server for the web session
     *
     * @returns {string} clientID provided by the server
     */
    getClientId() {
        return this.clientId;
    }

    async getOfflineMaps() {
        return this.get("maps/").then((response) => {
            return response as Promise<MapsDirectory>;
        });
    }

    async putOfflineTile(map_name: string, zoom: number, x: number, y: number, data: Blob) {
        return fetch(`maps/${map_name}/${zoom}/${x}/${y}`, {
            method: "PUT",
            body: data,
        });
    }

    async putOfflineGeoTiff(map_name: string, data: BodyInit) {
        return fetch(`maps/${map_name}/geotiff`, {
            method: "PUT",
            body: data,
        });
    }

    async putOfflineGeoTiffChunk(map_name: string, chunk_index: number, chunk: BodyInit) {
        return fetch(`maps/${map_name}/geotiffchunk/${chunk_index}`, {
            method: "PUT",
            body: chunk,
        });
    }

    async deleteOfflineMap(mapName: string) {
        return fetch(`maps/${mapName}`, {
            method: "DELETE",
        });
    }

    async getCTDProfiles() {
        return fetch("ctd-profiles", {
            method: "GET",
        });
    }

    postMissionFilesCreate(descriptor: any) {
        return this.post("missionfiles/create", descriptor);
    }

    // ── Exclusion zone hub storage ──────────────────────────────────────────

    async listExclusionZones(): Promise<string[]> {
        const response = await this.get("jaia/v0/exclusion-zones");
        return response?.result ?? [];
    }

    async saveExclusionZone(name: string, snapshot: any): Promise<void> {
        await this.post(`jaia/v0/exclusion-zones/${encodeURIComponent(name)}`, snapshot);
    }

    async loadExclusionZone(name: string): Promise<any | null> {
        try {
            return await this.get(`jaia/v0/exclusion-zones/${encodeURIComponent(name)}`);
        } catch {
            return null;
        }
    }

    async deleteExclusionZone(name: string): Promise<void> {
        await this.delete(`jaia/v0/exclusion-zones/${encodeURIComponent(name)}`);
    }

    // ── Mission set hub storage ─────────────────────────────────────────────

    async listMissionSets(): Promise<string[]> {
        const response = await this.get("jaia/v0/mission-sets");
        return response?.result ?? [];
    }

    async saveMissionSet(name: string, snapshot: any): Promise<void> {
        await this.post(`jaia/v0/mission-sets/${encodeURIComponent(name)}`, snapshot);
    }

    async loadMissionSet(name: string): Promise<any | null> {
        try {
            return await this.get(`jaia/v0/mission-sets/${encodeURIComponent(name)}`);
        } catch {
            return null;
        }
    }

    async deleteMissionSet(name: string): Promise<void> {
        await this.delete(`jaia/v0/mission-sets/${encodeURIComponent(name)}`);
    }
}

export const jaiaAPI = new JaiaAPI(randomBase57(22), "/", false);
