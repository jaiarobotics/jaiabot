import { getCTDFiles } from "../download";
import { getNotifications } from "../../notifications";

function mockFetchResponse(response: Partial<Response>) {
    global.fetch = jest.fn(() => Promise.resolve(response)) as unknown as typeof fetch;
}

function latestNotification() {
    const notifications = getNotifications();
    return notifications[notifications.length - 1];
}

describe("getCTDFiles", () => {
    test("reports an API error instead of downloading it as the archive", async () => {
        const blob = jest.fn();
        mockFetchResponse({
            ok: true,
            status: 200,
            headers: new Headers({ "Content-Type": "application/json" }),
            json: () => Promise.resolve({ error: { details: "Disk full" } }),
            blob,
        });

        await getCTDFiles();

        expect(blob).not.toHaveBeenCalled();
        expect(latestNotification()).toMatchObject({
            severity: "error",
            message: "Could not download CTD profiles from the Hub: Disk full",
        });
    });

    test("reports an HTTP error instead of downloading it as the archive", async () => {
        const blob = jest.fn();
        mockFetchResponse({
            ok: false,
            status: 502,
            statusText: "Bad Gateway",
            headers: new Headers({ "Content-Type": "text/html" }),
            json: () => Promise.reject(new SyntaxError("Not JSON")),
            blob,
        });

        await getCTDFiles();

        expect(blob).not.toHaveBeenCalled();
        expect(latestNotification()).toMatchObject({
            severity: "error",
            message: "Could not download CTD profiles from the Hub: Bad Gateway",
        });
    });
});
