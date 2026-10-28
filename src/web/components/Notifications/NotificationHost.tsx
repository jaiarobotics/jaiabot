import { useEffect, useSyncExternalStore } from "react";
import { Alert, Snackbar, Stack } from "@mui/material";

import {
    NOTIFICATION_TIMEOUT_MS,
    Notification,
    dismissNotification,
    getNotifications,
    subscribeToNotifications,
} from "../../utils/notifications";

function NotificationAlert({ notification }: { notification: Notification }) {
    useEffect(() => {
        const timer = setTimeout(
            () => dismissNotification(notification.id),
            NOTIFICATION_TIMEOUT_MS,
        );
        return () => clearTimeout(timer);
    }, [notification.id]);

    return (
        <Alert severity={notification.severity} variant="filled">
            {notification.message}
        </Alert>
    );
}

/**
 * Renders the notifications raised by utils/notifications
 *
 * @returns {React.JSX.Element | null} Stacked alerts, or null when there is nothing to show
 */
export default function NotificationHost() {
    const notifications = useSyncExternalStore(subscribeToNotifications, getNotifications);

    if (notifications.length === 0) {
        return null;
    }

    return (
        <Snackbar open anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
            <Stack spacing={1}>
                {notifications.map((notification) => (
                    <NotificationAlert key={notification.id} notification={notification} />
                ))}
            </Stack>
        </Snackbar>
    );
}
