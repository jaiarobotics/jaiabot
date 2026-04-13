import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

/**
 * Modal shown when a zone change causes one or more mission plans to cross an
 * exclusion zone. Lets the operator confirm the re-routed plan or keep the
 * current waypoints unchanged.
 */
export default function MissionRerouteDialog() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const pending = jaiaContext?.pendingReroute;
    if (!pending) return null;

    const missionCount = pending.proposals.length;
    const bypassCount = pending.totalBypassCount;

    return (
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog">
                <h1>Route Update Required</h1>
                <p>
                    Zone changes affect <strong>{missionCount}</strong> mission
                    {missionCount !== 1 ? "s" : ""}. The following bypass waypoints will be added:
                </p>
                <ul style={{ margin: "8px 0 12px 16px", padding: 0 }}>
                    {pending.proposals.map((p) => (
                        <li key={p.missionID}>
                            Mission {p.missionID}: <strong>{p.bypassCount}</strong> bypass waypoint
                            {p.bypassCount !== 1 ? "s" : ""}
                        </li>
                    ))}
                </ul>
                <p style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                    Total: {bypassCount} bypass waypoint{bypassCount !== 1 ? "s" : ""}. Existing
                    auto-bypass waypoints will be replaced.
                </p>
                <div className="dialog-button-row">
                    <button
                        className="dialog-button"
                        onClick={() => jaiaDispatch({ type: JaiaActions.CANCEL_MISSION_REROUTE })}
                    >
                        Keep Original
                    </button>
                    <button
                        className="dialog-button"
                        onClick={() => jaiaDispatch({ type: JaiaActions.CONFIRM_MISSION_REROUTE })}
                    >
                        Update Route
                    </button>
                </div>
            </div>
        </div>
    );
}
