import { sendBotCommand, sendEngineeringCommand, sendHubCommand } from "../commands";
import { jaia_rest_api, JaiaRESTAPIError } from "../jaia-rest-api";
import { dismissNotification, getNotifications } from "../notifications";
import { APIErrorCode } from "@proto/jaiabot/messages/rest_api";
import {
    Command_CommandType,
    CommandForHub_HubCommandType,
} from "@proto/jaiabot/messages/jaia_dccl";

const request = jest.spyOn(jaia_rest_api, "request");

function errorMessages() {
    return getNotifications()
        .filter((notification) => notification.severity === "error")
        .map((notification) => notification.message);
}

beforeEach(() => {
    request.mockReset();
    for (const notification of getNotifications()) {
        dismissNotification(notification.id);
    }
});

describe("sendBotCommand", () => {
    const stop = { bot_id: 1, type: Command_CommandType.STOP };

    test("resolves with the response when the command is sent", async () => {
        request.mockResolvedValue({ command_result: { command_sent: true } });

        const res = await sendBotCommand(stop);

        expect(res.error).toBeUndefined();
        expect(res.command_result?.command_sent).toBe(true);
        expect(errorMessages()).toEqual([]);
    });

    test("resolves with the API error instead of rejecting, and tells the operator", async () => {
        request.mockRejectedValue(
            new JaiaRESTAPIError(
                APIErrorCode.API_ERROR__NOT_IN_CONTROL,
                "Client x is not in control",
            ),
        );

        const res = await sendBotCommand(stop);

        expect(res.error?.code).toBe(APIErrorCode.API_ERROR__NOT_IN_CONTROL);
        expect(errorMessages()).toEqual([
            expect.stringMatching(/^Could not send STOP to Bot 1: .*not in control/),
        ]);
    });

    test("resolves with an error when the request itself fails", async () => {
        request.mockRejectedValue(new TypeError("Failed to fetch"));

        const res = await sendBotCommand(stop);

        expect(res.error?.details).toBe("Failed to fetch");
        expect(errorMessages()).toEqual(["Could not send STOP to Bot 1: Failed to fetch"]);
    });

    test("can leave the notification to the caller", async () => {
        request.mockRejectedValue(new TypeError("Failed to fetch"));

        const res = await sendBotCommand(stop, { notifyOnError: false });

        expect(res.error).toBeDefined();
        expect(errorMessages()).toEqual([]);
    });
});

test("sendHubCommand resolves with an error instead of rejecting", async () => {
    request.mockRejectedValue(new TypeError("Failed to fetch"));

    const res = await sendHubCommand({
        hub_id: 1,
        type: CommandForHub_HubCommandType.SCAN_FOR_BOTS,
    });

    expect(res.error).toBeDefined();
    expect(errorMessages()).toEqual(["Could not send SCAN_FOR_BOTS to Hub 1: Failed to fetch"]);
});

test("sendEngineeringCommand resolves with an error instead of rejecting", async () => {
    request.mockRejectedValue(
        new JaiaRESTAPIError(APIErrorCode.API_ERROR__NOT_IN_CONTROL, "Client x is not in control"),
    );

    const res = await sendEngineeringCommand({ bot_id: 2, query_bot_status: true });

    expect(res.error?.code).toBe(APIErrorCode.API_ERROR__NOT_IN_CONTROL);
    expect(errorMessages()).toEqual([
        expect.stringMatching(/^Could not send engineering command to Bot 2: /),
    ]);
});
