import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

/**
 * Modal shown when waypoints fall inside an exclusion zone. When the
 * post-removal state also requires route bypasses, both are shown here so
 * the operator can confirm or cancel in a single step.
 */
export default function WaypointRemovalDialog() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const pending = jaiaContext?.pendingWaypointRemoval;
    if (!pending) return null;

    const reroute = pending.followUpReroute;

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>Mission Plan Update Required</h1>

                <p>
                    <strong>{pending.totalRemovedCount}</strong> waypoint
                    {pending.totalRemovedCount !== 1 ? "s" : ""} fall inside an exclusion zone and
                    will be removed:
                </p>
                <ul style={{ margin: "8px 0 12px 16px", padding: 0 }}>
                    {pending.proposals.map((p) => (
                        <li key={p.missionID}>
                            Mission {p.missionID}: <strong>{p.removedCount}</strong> waypoint
                            {p.removedCount !== 1 ? "s" : ""} removed
                        </li>
                    ))}
                </ul>

                {reroute && (
                    <>
                        <p>
                            The updated route also crosses a zone.{" "}
                            <strong>{reroute.totalBypassCount}</strong> bypass waypoint
                            {reroute.totalBypassCount !== 1 ? "s" : ""} will be added:
                        </p>
                        <ul style={{ margin: "8px 0 12px 16px", padding: 0 }}>
                            {reroute.proposals.map((p) => (
                                <li key={p.missionID}>
                                    Mission {p.missionID}: <strong>{p.bypassCount}</strong> bypass
                                    waypoint{p.bypassCount !== 1 ? "s" : ""}
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                <div className="dialog-button-row">
                    <button
                        className="dialog-button"
                        onClick={() => jaiaDispatch({ type: JaiaActions.CANCEL_WAYPOINT_REMOVAL })}
                    >
                        Cancel
                    </button>
                    <button
                        className="dialog-button"
                        onClick={() => jaiaDispatch({ type: JaiaActions.CONFIRM_WAYPOINT_REMOVAL })}
                    >
                        Update Plan
                    </button>
                </div>
            </div>
        </div>
    );
}
