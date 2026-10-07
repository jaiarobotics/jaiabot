import { randomBase57 } from "../shared/Utilities";
import { APIRequest, APIResponse } from "@proto/jaiabot/messages/rest_api";

export class JaiaRESTAPI {
    clientId: string;
    port: number;
    base_url: URL;
    headers: { [key: string]: string };

    constructor(clientId: string | null = null, port = 9092) {
        this.clientId = clientId ?? randomBase57(22);

        console.info(`Jaia REST API v1 clientId = ${this.clientId}`);

        this.base_url = new URL("/jaia/v1", window.location.href);
        this.base_url.port = port.toString();
        this.port = port;

        console.info(`Jaia REST API v1 base URL = ${this.base_url.href}`);

        this.headers = {
            "Content-Type": "application/json; charset=utf-8",
            clientId: this.clientId,
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
