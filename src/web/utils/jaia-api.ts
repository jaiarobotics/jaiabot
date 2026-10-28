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
    url: string;
    headers: { [key: string]: string };

    constructor(url: string) {
        this.url = url;
        this.headers = {
            "Content-Type": "application/json; charset=utf-8",
        };
    }

    hit(method: string, endpoint: string, requestBody?: any) {
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
                (res) => res,
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
}

export const jaiaAPI = new JaiaAPI("/");
