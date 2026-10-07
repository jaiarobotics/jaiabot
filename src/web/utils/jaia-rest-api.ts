import { randomBase57 } from "../shared/Utilities";
import { APIRequest, APIResponse } from "@proto/jaiabot/messages/rest_api";
import { FeatureCollection, Geometry } from "geojson";

export class JaiaRESTAPI {
    client_id: string;
    port: number;
    base_url: URL;
    headers: { [key: string]: string };

    constructor(client_id: string | null = null, port = 9092) {
        this.client_id = client_id ?? randomBase57(22);

        console.info(`Jaia REST API v1 clientId = ${this.client_id}`);

        this.base_url = new URL("/jaia/v1", window.location.href);
        this.base_url.port = port.toString();
        this.port = port;

        console.info(`Jaia REST API v1 base URL = ${this.base_url.href}`);

        this.headers = {
            "Content-Type": "application/json; charset=utf-8",
            clientId: this.client_id,
        };
    }

    async request(api_request: APIRequest): Promise<APIResponse> {
        return fetch(this.base_url.href, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(api_request),
        })
            .then((response) => {
                return response.json() as APIResponse;
            })
            .then((response) => {
                if (response.error) {
                    throw new Error(`${response.error?.code}: ${response.error?.details}`);
                }
                return response;
            })
            .catch((error) => {
                console.error("API Request Error:", error);
                throw error;
            });
    }

    async geojson_request(api_request: APIRequest): Promise<FeatureCollection<Geometry>> {
        return fetch(this.base_url.href, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(api_request),
        })
            .then((response) => {
                return response.json() as Promise<FeatureCollection<Geometry>>;
            })
            .catch((error) => {
                console.error("API Request Error:", error);
                throw error;
            });
    }

    // Higher level helpers
    async takeControl(): Promise<APIResponse> {
        return this.request({
            target: {
                all: true,
            },
            take_control_client_id: this.client_id,
        });
    }
}

export const jaia_rest_api = new JaiaRESTAPI();

jaia_rest_api
    .request({
        target: {
            all: true,
        },
        status: true,
    })
    .then((response) => console.log("API Status:", response));
