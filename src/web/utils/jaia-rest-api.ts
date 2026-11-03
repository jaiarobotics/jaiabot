import { randomBase57 } from "../shared/Utilities";
import { APIErrorCode, APIRequest, APIResponse } from "@proto/jaiabot/messages/rest_api";
import { FeatureCollection, Geometry } from "geojson";

export class JaiaRESTAPIError extends Error {
    code?: APIErrorCode;

    constructor(code?: APIErrorCode, details?: string) {
        super(`${code}: ${details}`);
        this.code = code;
    }
}

export class JaiaRESTAPI {
    client_id: string;
    base_url: URL;
    headers: { [key: string]: string };

    constructor(client_id: string | null = null) {
        this.client_id = client_id ?? randomBase57(22);

        console.info(`Jaia REST API v1 clientId = ${this.client_id}`);

        this.base_url = new URL("/jaia/v1", window.location.href);

        this.headers = {
            "Content-Type": "application/json; charset=utf-8",
            clientId: this.client_id,
        };
    }

    /**
     * Sends a request to the REST API
     *
     * @param {APIRequest} api_request Request to send
     * @param {number} [timeout_ms] Abort the request if the whole response hasn't arrived by then
     * @returns {Promise<APIResponse>} The API's response
     *
     * @notes
     * Browsers set no deadline of their own, so without one a request the hub never answers can
     * stay pending indefinitely.
     */
    async request(api_request: APIRequest, timeout_ms?: number): Promise<APIResponse> {
        const controller = new AbortController();
        const timer =
            timeout_ms === undefined ? undefined : setTimeout(() => controller.abort(), timeout_ms);

        return this.fetch_request(api_request, controller.signal)
            .then((response) => {
                return response.json() as APIResponse;
            })
            .then((response) => {
                if (response.error) {
                    throw new JaiaRESTAPIError(response.error.code, response.error.details);
                }
                return response;
            })
            .catch((error) => {
                console.error("API Request Error:", error);
                throw error;
            })
            .finally(() => clearTimeout(timer));
    }

    async geojson_request(api_request: APIRequest): Promise<FeatureCollection<Geometry>> {
        return this.fetch_request(api_request)
            .then((response) => {
                return response.json() as Promise<FeatureCollection<Geometry>>;
            })
            .catch((error) => {
                console.error("API Request Error:", error);
                throw error;
            });
    }

    async fetch_request(api_request: APIRequest, signal?: AbortSignal): Promise<Response> {
        const response = await fetch(this.base_url.href, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(api_request),
            redirect: "manual",
            signal,
        });
        // CloudHub redirects to sign in once the session expires; reloading takes the operator there and back
        if (response.type === "opaqueredirect") {
            location.reload();
        }
        return response;
    }

    // Higher level helpers
    async takeControl(): Promise<APIResponse> {
        return this.request({
            target: {
                all: true,
            },
            take_control: this.client_id,
        });
    }
}

export const jaia_rest_api = new JaiaRESTAPI();

/**
 * Returns null instead of rejecting when the API reports that a requested record doesn't exist
 *
 * @param {Promise<T>} request Pending API request
 * @returns {Promise<T | null>} The request's result, or null if the record was not found
 */
export async function nullIfRecordNotFound<T>(request: Promise<T>): Promise<T | null> {
    try {
        return await request;
    } catch (error) {
        if (
            error instanceof JaiaRESTAPIError &&
            error.code === APIErrorCode.API_ERROR__RECORD_NOT_FOUND
        ) {
            return null;
        }
        throw error;
    }
}
