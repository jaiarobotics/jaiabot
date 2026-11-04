import CircularProgress from "@mui/material/CircularProgress";

interface Props {
    label: string;
    isRunning: boolean;
    disabled: boolean;
    onClick: () => void;
}

/** A button for a reroute or restore, showing a spinner while it runs. */
export default function RoutingActionButton(props: Props) {
    return (
        <button className="routing-button" disabled={props.disabled} onClick={props.onClick}>
            {props.isRunning ? <CircularProgress size={18} aria-label="Working" /> : props.label}
        </button>
    );
}
