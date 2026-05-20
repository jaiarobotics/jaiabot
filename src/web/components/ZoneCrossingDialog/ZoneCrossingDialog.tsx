interface ZoneCrossingDialogProps {
    waypointNumber: number;
    bypassCount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ZoneCrossingDialog({
    waypointNumber,
    bypassCount,
    onConfirm,
    onCancel,
}: ZoneCrossingDialogProps) {
    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>Route Crosses a Zone</h1>
                <p>
                    The path to waypoint {waypointNumber} has been rerouted to include{" "}
                    <strong>{bypassCount}</strong> bypass waypoint{bypassCount !== 1 ? "s" : ""}.
                </p>
                <div className="dialog-button-row">
                    <button className="dialog-button" onClick={onCancel}>
                        Cancel
                    </button>
                    <button className="dialog-button" onClick={onConfirm}>
                        Add Waypoints
                    </button>
                </div>
            </div>
        </div>
    );
}
