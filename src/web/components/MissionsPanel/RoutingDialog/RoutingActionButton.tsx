import CircularProgress from "@mui/material/CircularProgress";

import "./RoutingDialog.less";

interface Props {
    label: string;
    isRunning: boolean;
    disabled: boolean;
    onClick: () => void;
}

/** A dialog button for a reroute or restore, showing a spinner while it runs. */
export default function RoutingActionButton(props: Props) {
    return (
        <button
            className="dialog-button routing-action-button"
            disabled={props.disabled}
            onClick={props.onClick}
        >
            {props.isRunning ? <CircularProgress size={18} aria-label="Working" /> : props.label}
        </button>
    );
}
