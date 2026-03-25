import { useContext } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import "./NotificationDot.less";

interface Props {
    className: string;
}

/**
 * Renders a small circle to notify operators of system conditions such as
 * Internet connection and upgrade status
 */
export default function NotificationDot(props: Props) {
    const jaiaContext = useContext(JaiaContext);

    if (!jaiaContext) {
        return null;
    }

    if (!jaiaContext.jaiaGlobal.getIsInternetConnected()) {
        return <div className={`notification-dot ${props.className} yellow`}></div>;
    }

    if (jaiaContext.jaiaGlobal.getIsUpgradeAvailable()) {
        return <div className={`notification-dot ${props.className} red`}></div>;
    }

    return null;
}
