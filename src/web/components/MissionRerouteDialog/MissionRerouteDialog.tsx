import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { MAX_WAYPOINTS } from "../../utils/constants";

/**
 * Shown when zone/mission actions produce route crossings that need operator review.
 *
 * For zone loads, loadedZoneIDs tracks what was added so "Revert all" can clean
 * everything up. skippedZoneIDs are zones that were already removed before this
 * dialog was shown. For mission actions, over-limit missions are deleted on confirm.
 */
export default function MissionRerouteDialog() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const pending = jaiaContext?.pendingReroute;
    if (!pending) return null;

    const isZoneLoad = pending.loadedZoneIDs !== undefined;
    const feasible = pending.proposals.filter((p) => !p.isOverLimit);
    const overLimit = pending.proposals.filter((p) => p.isOverLimit);
    const skipped = pending.skippedZoneIDs ?? [];

    const handleCancel = () => jaiaDispatch({ type: JaiaActions.CANCEL_MISSION_REROUTE });
    const handleConfirm = () => jaiaDispatch({ type: JaiaActions.CONFIRM_MISSION_REROUTE });

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>Route Update Required</h1>

                {skipped.length > 0 && (
                    <>
                        <p style={{ fontSize: "0.85rem", color: "#f87171" }}>
                            {skipped.length} zone{skipped.length !== 1 ? "s" : ""} could not be
                            loaded — routing around {skipped.length !== 1 ? "them" : "it"} would
                            exceed the {MAX_WAYPOINTS}-waypoint limit:
                        </p>
                        <ul
                            style={{
                                margin: "8px 0 12px 16px",
                                padding: 0,
                                color: "#f87171",
                                fontSize: "0.85rem",
                            }}
                        >
                            {skipped.map((id) => (
                                <li key={id}>Zone {id}</li>
                            ))}
                        </ul>
                    </>
                )}

                {feasible.length > 0 && (
                    <>
                        <p>
                            The following mission{feasible.length !== 1 ? "s" : ""} will be
                            rerouted:
                        </p>
                        <ul style={{ margin: "8px 0 12px 16px", padding: 0 }}>
                            {feasible.map((p) => (
                                <li key={p.missionID}>
                                    Mission {p.missionID}: <strong>{p.bypassCount}</strong> bypass
                                    waypoint
                                    {p.bypassCount !== 1 ? "s" : ""} added
                                </li>
                            ))}
                        </ul>
                        <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                            Total: {pending.totalBypassCount} bypass waypoint
                            {pending.totalBypassCount !== 1 ? "s" : ""}. Existing auto-bypass
                            waypoints will be replaced.
                        </p>
                    </>
                )}

                {overLimit.length > 0 && (
                    <>
                        <p style={{ fontSize: "0.85rem", color: "#f87171" }}>
                            The following mission{overLimit.length !== 1 ? "s" : ""} will be removed
                            from the plan — adding bypass waypoints would exceed the {MAX_WAYPOINTS}
                            -waypoint limit:
                        </p>
                        <ul
                            style={{
                                margin: "8px 0 12px 16px",
                                padding: 0,
                                color: "#f87171",
                                fontSize: "0.85rem",
                            }}
                        >
                            {overLimit.map((p) => (
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
                        {isZoneLoad ? "Revert all" : "Revert"}
                    </button>
                    <button className="dialog-button" onClick={handleConfirm}>
                        {isZoneLoad ? "Proceed" : "Update Route"}
                    </button>
                </div>
            </div>
        </div>
    );
}
