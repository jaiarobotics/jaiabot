import { useContext } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import { MAX_WAYPOINTS } from "../../../utils/constants";
import {
    PendingReroute,
    ProposalStatus,
} from "../../../data/obstacle_avoidance_data/pending-route-data";
import ObstacleAvoidanceBaseDialog from "../Common/ObstacleAvoidanceBaseDialog";
import RerouteSummary from "../Common/RerouteSummary";
import { describeRevert, dismissButtonLabel } from "../Common/revert-messaging";

export default function MissionRerouteDialog({ pending }: { pending: PendingReroute }) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const loadSummary = pending.loadSummary;
    const isZoneLoad = loadSummary?.kind === "zoneLoad";

    const feasible = pending.proposals.filter((p) => p.status === ProposalStatus.FEASIBLE);
    const overLimit = pending.proposals.filter((p) => p.status === ProposalStatus.OVER_LIMIT);
    const impossible = pending.proposals.filter((p) => p.status === ProposalStatus.IMPOSSIBLE);
    const hasFeasibleReroute = feasible.length > 0;

    const skippedZones = loadSummary?.kind === "zoneLoad" ? loadSummary.skippedZoneIDs : [];
    const loadedZones = loadSummary?.kind === "zoneLoad" ? loadSummary.loadedZoneIDs : [];

    const canProceed = isZoneLoad ? loadedZones.length > 0 : true;

    const handleCancel = () => jaiaDispatch({ type: JaiaActions.CANCEL_MISSION_REROUTE });
    const handleConfirm = () => jaiaDispatch({ type: JaiaActions.CONFIRM_MISSION_REROUTE });

    const revertDescription = describeRevert(pending.revert);
    const buttons = [
        {
            label: dismissButtonLabel(pending.revert, !hasFeasibleReroute),
            onClick: handleCancel,
        },
    ];
    if (canProceed && hasFeasibleReroute) {
        buttons.push({ label: "Confirm", onClick: handleConfirm });
    }

    return (
        <ObstacleAvoidanceBaseDialog title="Route Update Required" buttons={buttons}>
            {/* Zone load */}
            {isZoneLoad && loadedZones.length > 0 && (
                <p>
                    <strong>{loadedZones.length}</strong> zone
                    {loadedZones.length !== 1 ? "s" : ""} loaded
                    {pending.totalBypassCount > 0 && (
                        <>
                            {" "}
                            — confirming will add <strong>{pending.totalBypassCount}</strong> bypass
                            waypoint
                            {pending.totalBypassCount !== 1 ? "s" : ""}
                        </>
                    )}
                    .
                </p>
            )}
            {isZoneLoad && skippedZones.length > 0 && (
                <>
                    <p className="dialog-warn">
                        <strong>{skippedZones.length}</strong> zone
                        {skippedZones.length !== 1 ? "s" : ""} could not be loaded — routing around{" "}
                        {skippedZones.length !== 1 ? "them" : "it"} is impossible or would exceed
                        the {MAX_WAYPOINTS}-waypoint limit:
                    </p>
                    <ul className="dialog-warn-list">
                        {skippedZones.map((id) => (
                            <li key={id}>Zone {id}</li>
                        ))}
                    </ul>
                </>
            )}

            {/* Mission load */}
            {/* Non-load: reroute summary */}
            {!isZoneLoad && feasible.length > 0 && (
                <p>
                    Confirming will reroute the mission{feasible.length !== 1 ? "s" : ""} to include{" "}
                    <strong>{pending.totalBypassCount}</strong> bypass waypoint
                    {pending.totalBypassCount !== 1 ? "s" : ""}.
                </p>
            )}

            {!isZoneLoad && feasible.length === 0 && (
                <p className="dialog-warn">None of the missions can be rerouted.</p>
            )}

            {revertDescription && <p>Reverting will {revertDescription}.</p>}

            <RerouteSummary
                proposals={pending.proposals}
                overLimitMessage={`The following mission${overLimit.length !== 1 ? "s" : ""} cannot be routed around the zones — the detour would exceed the ${MAX_WAYPOINTS}-waypoint limit. They are left as they are:`}
                impossibleMessage={`The following mission${impossible.length !== 1 ? "s" : ""} have no clear route around the zone — move the conflicting waypoints further away or resize the zone:`}
            />
        </ObstacleAvoidanceBaseDialog>
    );
}
