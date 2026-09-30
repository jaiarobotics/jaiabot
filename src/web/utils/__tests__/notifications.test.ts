import {
    dismissNotification,
    error,
    getNotifications,
    info,
    messageLog,
    subscribeToNotifications,
    success,
    warning,
} from "../notifications";

function clearNotifications() {
    getNotifications().forEach((notification) => dismissNotification(notification.id));
}

beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    clearNotifications();
    jest.restoreAllMocks();
});

describe("notification store", () => {
    test("raises a notification carrying the severity and message", () => {
        info("mission started");

        expect(getNotifications()).toEqual([
            expect.objectContaining({ severity: "info", message: "mission started" }),
        ]);
    });

    test("collapses a repeat of a notification already on screen", () => {
        warning("low battery");
        warning("low battery");

        expect(getNotifications()).toHaveLength(1);
    });

    test("keeps the same message raised at a different severity", () => {
        info("link lost");
        error("link lost");

        expect(getNotifications().map((notification) => notification.severity)).toEqual([
            "info",
            "error",
        ]);
    });

    test("raises a message again once the earlier one has been dismissed", () => {
        success("bot activated");
        clearNotifications();
        success("bot activated");

        expect(getNotifications()).toHaveLength(1);
    });

    test("gives each notification a distinct id", () => {
        info("first");
        info("second");
        info("third");

        const ids = getNotifications().map((notification) => notification.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    test("dismisses only the requested notification", () => {
        info("keep me");
        info("drop me");
        const [kept, dropped] = getNotifications();

        dismissNotification(dropped.id);

        expect(getNotifications()).toEqual([kept]);
    });

    test("dismissing an unknown id leaves the list alone", () => {
        info("still here");

        dismissNotification(-1);

        expect(getNotifications()).toHaveLength(1);
    });

    test("notifies subscribers when the list changes", () => {
        const listener = jest.fn();
        subscribeToNotifications(listener);

        info("raised");
        dismissNotification(getNotifications()[0].id);

        expect(listener).toHaveBeenCalledTimes(2);
    });

    test("stops notifying a subscriber that has unsubscribed", () => {
        const listener = jest.fn();
        const unsubscribe = subscribeToNotifications(listener);

        unsubscribe();
        info("raised");

        expect(listener).not.toHaveBeenCalled();
    });

    test("does not publish when a duplicate is collapsed", () => {
        info("same");
        const listener = jest.fn();
        subscribeToNotifications(listener);

        info("same");

        expect(listener).not.toHaveBeenCalled();
    });

    // useSyncExternalStore re-renders off reference identity, so an unchanged list must not
    // hand back a fresh array
    test("returns a stable reference until the list changes", () => {
        info("stable");
        const snapshot = getNotifications();

        expect(getNotifications()).toBe(snapshot);

        info("changed");

        expect(getNotifications()).not.toBe(snapshot);
    });

    test("records each message in the log with its severity prefix", () => {
        const before = messageLog.length;

        info("logged info");
        warning("logged warning");
        error("logged error");
        success("logged success");

        expect(messageLog.slice(before)).toEqual([
            "INFO logged info",
            "WARNING logged warning",
            "ERROR logged error",
            "SUCCESS logged success",
        ]);
    });
});
