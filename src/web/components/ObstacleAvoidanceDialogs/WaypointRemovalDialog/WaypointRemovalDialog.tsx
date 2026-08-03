import { useContext } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { MAX_WAYPOINTS } from "../../../utils/constants";
import {
    PendingWaypointRemoval,
    ProposalStatus,
} from "../../../data/obstacle_avoidance_data/pending-route-data";
import ObstacleAvoidanceBaseDialog from "../Common/ObstacleAvoidanceBaseDialog";
import RerouteSummary from "../Common/RerouteSummary";

/**
 * Shown when waypoints fall inside an exclusion zone. If the post-removal
 * route still crosses a zone, the follow-up reroute is shown here too so
 * both changes can be confirmed or reverted together.
 */
export default function WaypointRemovalDialog({ pending }: { pending: PendingWaypointRemoval }) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const reroute = pending.followUpReroute;
    const rerouteFeasible =
        reroute?.proposals.filter((p) => p.status === ProposalStatus.FEASIBLE) ?? [];
    const rerouteOverLimit =
        reroute?.proposals.filter((p) => p.status === ProposalStatus.OVER_LIMIT) ?? [];
    const rerouteImpossible =
        reroute?.proposals.filter((p) => p.status === ProposalStatus.IMPOSSIBLE) ?? [];
    const hasFollowUpReroute = !!reroute;
    const hasFeasibleFollowUp = hasFollowUpReroute && rerouteFeasible.length > 0;

    const handleCancel = () => jaiaDispatch({ type: JaiaActions.CANCEL_WAYPOINT_REMOVAL });
    const handleConfirm = () => jaiaDispatch({ type: JaiaActions.CONFIRM_WAYPOINT_REMOVAL });

    const buttons = [
        {
            label: hasFollowUpReroute && !hasFeasibleFollowUp ? "Revert All" : "Revert",
            onClick: handleCancel,
        },
    ];
    if (!hasFollowUpReroute || hasFeasibleFollowUp) {
        buttons.push({ label: "Confirm", onClick: handleConfirm });
    }

    return (
        <ObstacleAvoidanceBaseDialog title="Mission Plan Update Required" buttons={buttons}>
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
                    Confirming will reroute the following mission
                    {rerouteFeasible.length !== 1 ? "s" : ""} to include{" "}
                    <strong>{reroute!.totalBypassCount}</strong> bypass waypoint
                    {reroute!.totalBypassCount !== 1 ? "s" : ""}.
                </p>
            )}

            {hasFollowUpReroute && rerouteFeasible.length === 0 && (
                <p className="dialog-warn">
                    None of the remaining missions can be rerouted with the current zone layout.
                </p>
            )}

            <RerouteSummary
                proposals={reroute?.proposals ?? []}
                overLimitMessage={`The following mission${rerouteOverLimit.length !== 1 ? "s" : ""} still cross a zone after waypoint removal but cannot be rerouted — adding bypass waypoints would exceed the ${MAX_WAYPOINTS}-waypoint limit:`}
                impossibleMessage={`The following mission${rerouteImpossible.length !== 1 ? "s" : ""} still cross a zone after waypoint removal and cannot be rerouted with the current zone layout:`}
            />
        </ObstacleAvoidanceBaseDialog>
    );
}
