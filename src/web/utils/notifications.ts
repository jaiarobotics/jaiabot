// Toast notification used for giving feedback to user for broadcast commands where receiving ack is not feasible

export type NotificationSeverity = "info" | "warning" | "error" | "success";

export interface Notification {
    id: number;
    severity: NotificationSeverity;
    message: string;
}

export const NOTIFICATION_TIMEOUT_MS = 5000;

const messageLog: string[] = [];

let notifications: Notification[] = [];
let nextNotificationID = 0;
const listeners = new Set<() => void>();

function publish() {
    listeners.forEach((listener) => listener());
}

function notify(severity: NotificationSeverity, message: string) {
    const isDuplicate = notifications.some(
        (notification) => notification.severity === severity && notification.message === message,
    );
    if (isDuplicate) {
        return;
    }
    notifications = [...notifications, { id: nextNotificationID++, severity, message }];
    publish();
}

export function subscribeToNotifications(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getNotifications() {
    return notifications;
}

export function dismissNotification(id: number) {
    notifications = notifications.filter((notification) => notification.id !== id);
    publish();
}

const info = function info(message: string) {
    console.log(`INFO ${message}`);
    messageLog.push(`INFO ${message}`);
    notify("info", message);
};

const warning = function warning(message: string) {
    console.warn(`WARNING ${message}`);
    messageLog.push(`WARNING ${message}`);
    notify("warning", message);
};

const error = function error(message: string) {
    console.error(`ERROR ${message}`);
    messageLog.push(`ERROR ${message}`);
    notify("error", message);
};

const success = function success(message: string) {
    console.log(`SUCCESS ${message}`);
    messageLog.push(`SUCCESS ${message}`);
    notify("success", message);
};

const debug = function debug(message: string) {
    console.log(`DEBUG ${message}`);
};

export { info, warning, error, success, debug, messageLog };
