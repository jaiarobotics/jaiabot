import CircularProgress from "@mui/material/CircularProgress";

interface Props {
    /** "calculating" → spinner; "ready" → show bypass count + confirm/cancel */
    state: "calculating" | "ready";
    bypassCount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Modal shown when the mission plan intersects an exclusion zone.
 *
 * - "calculating" state: shows a spinner while the bypass waypoints are computed.
 * - "ready" state: shows how many waypoints were added and lets the operator
 *   confirm (send modified plan) or cancel (abort mission start).
 */
export function RouteAdjustmentDialog(props: Props) {
    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>Route Adjustment</h1>

                {props.state === "calculating" ? (
                    <div style={{ textAlign: "center", padding: "12px 0" }}>
                        <CircularProgress size={32} />
                        <p style={{ marginTop: 12 }}>
                            Calculating bypass route around exclusion zone…
                        </p>
                    </div>
                ) : (
                    <p>
                        The mission path intersects an exclusion zone.{" "}
                        <strong>{props.bypassCount}</strong> bypass waypoint
                        {props.bypassCount !== 1 ? "s have" : " has"} been added to route around it.
                    </p>
                )}

                <div className="dialog-button-row">
                    <button className="dialog-button" onClick={props.onCancel}>
                        Cancel
                    </button>
                    {props.state === "ready" && (
                        <button className="dialog-button" onClick={props.onConfirm}>
                            Send Mission
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
