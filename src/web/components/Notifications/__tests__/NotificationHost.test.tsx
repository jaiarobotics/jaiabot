import { act, render, screen } from "@testing-library/react";

import NotificationHost from "../NotificationHost";
import {
    NOTIFICATION_TIMEOUT_MS,
    dismissNotification,
    getNotifications,
    info,
    warning,
} from "../../../utils/notifications";

function clearNotifications() {
    act(() => {
        getNotifications().forEach((notification) => dismissNotification(notification.id));
    });
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    clearNotifications();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe("NotificationHost", () => {
    test("renders nothing while there is nothing to show", () => {
        const { container } = render(<NotificationHost />);

        expect(container).toBeEmptyDOMElement();
    });

    test("shows a notification raised after it has mounted", () => {
        render(<NotificationHost />);

        act(() => {
            info("mission started");
        });

        expect(screen.getByText("mission started")).toBeInTheDocument();
    });

    test("shows every outstanding notification at once", () => {
        render(<NotificationHost />);

        act(() => {
            info("mission started");
            warning("low battery");
        });

        expect(screen.getByText("mission started")).toBeInTheDocument();
        expect(screen.getByText("low battery")).toBeInTheDocument();
    });

    test("dismisses a notification once its timeout elapses", () => {
        render(<NotificationHost />);
        act(() => {
            info("mission started");
        });

        act(() => {
            jest.advanceTimersByTime(NOTIFICATION_TIMEOUT_MS);
        });

        expect(screen.queryByText("mission started")).not.toBeInTheDocument();
    });

    test("keeps a notification on screen until its timeout elapses", () => {
        render(<NotificationHost />);
        act(() => {
            info("mission started");
        });

        act(() => {
            jest.advanceTimersByTime(NOTIFICATION_TIMEOUT_MS - 1);
        });

        expect(screen.getByText("mission started")).toBeInTheDocument();
    });

    test("times each notification out from when it was raised", () => {
        render(<NotificationHost />);
        act(() => {
            info("first");
        });

        act(() => {
            jest.advanceTimersByTime(NOTIFICATION_TIMEOUT_MS / 2);
            warning("second");
        });
        act(() => {
            jest.advanceTimersByTime(NOTIFICATION_TIMEOUT_MS / 2);
        });

        expect(screen.queryByText("first")).not.toBeInTheDocument();
        expect(screen.getByText("second")).toBeInTheDocument();
    });

    test("stops listening to the store once unmounted", () => {
        const { unmount } = render(<NotificationHost />);

        unmount();

        expect(() =>
            act(() => {
                info("raised after unmount");
            }),
        ).not.toThrow();
        expect(screen.queryByText("raised after unmount")).not.toBeInTheDocument();
    });
});
