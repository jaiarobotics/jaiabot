import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { MAX_WAYPOINTS } from "../../utils/constants";

/**
 * Shown when waypoints fall inside an exclusion zone. If the post-removal
 * route still crosses a zone, the follow-up reroute is shown here too so
 * both changes can be confirmed or reverted together.
 */
export default function WaypointRemovalDialog() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const pending = jaiaContext?.pendingWaypointRemoval;
    if (!pending) return null;

    const reroute = pending.followUpReroute;
    const rerouteFeasible = reroute?.proposals.filter((p) => !p.isOverLimit) ?? [];
    const rerouteOverLimit = reroute?.proposals.filter((p) => p.isOverLimit) ?? [];

    const handleCancel = () => jaiaDispatch({ type: JaiaActions.CANCEL_WAYPOINT_REMOVAL });
    const handleConfirm = () => jaiaDispatch({ type: JaiaActions.CONFIRM_WAYPOINT_REMOVAL });

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>Mission Plan Update Required</h1>

                <p>
                    <strong>{pending.totalRemovedCount}</strong> waypoint
                    {pending.totalRemovedCount !== 1 ? "s" : ""} inside an exclusion zone will be
                    removed:
                </p>
                <ul className="dialog-list">
                    {pending.proposals.map((p) => (
                        <li key={p.missionID}>
                            Mission {p.missionID}: <strong>{p.removedCount}</strong> waypoint
                            {p.removedCount !== 1 ? "s" : ""} removed
                        </li>
                    ))}
                </ul>

                {rerouteFeasible.length > 0 && (
                    <p>
                        The updated route also crosses a zone and will add{" "}
                        <strong>{reroute!.totalBypassCount}</strong> bypass waypoint
                        {reroute!.totalBypassCount !== 1 ? "s" : ""}.
                    </p>
                )}

                {rerouteOverLimit.length > 0 && (
                    <>
                        <p className="dialog-warn">
                            The following mission{rerouteOverLimit.length !== 1 ? "s" : ""} still
                            cross a zone after waypoint removal but cannot be rerouted — adding
                            bypass waypoints would exceed the {MAX_WAYPOINTS}-waypoint limit:
                        </p>
                        <ul className="dialog-warn-list">
                            {rerouteOverLimit.map((p) => (
                                <li key={p.missionID}>
                                    Mission {p.missionID}: needs{" "}
                                    <strong>{p.newWaypoints.length}</strong> waypoints (limit{" "}
                                    {MAX_WAYPOINTS})
                                </li>
                            ))}
                        </ul>
                    </>
                )}

                <div className="dialog-button-row">
                    <button className="dialog-button" onClick={handleCancel}>
                        Revert
                    </button>
                    <button className="dialog-button" onClick={handleConfirm}>
                        Update Plan
                    </button>
                </div>
            </div>
        </div>
    );
}
