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
import { describeRevert, dismissButtonLabel, shouldOfferConfirm } from "../Common/revert-messaging";

export default function MissionRerouteDialog({ pending }: { pending: PendingReroute }) {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const feasible = pending.proposals.filter((p) => p.status === ProposalStatus.FEASIBLE);
    const overLimit = pending.proposals.filter((p) => p.status === ProposalStatus.OVER_LIMIT);
    const impossible = pending.proposals.filter((p) => p.status === ProposalStatus.IMPOSSIBLE);
    const hasFeasibleReroute = feasible.length > 0;

    const handleCancel = () => jaiaDispatch({ type: JaiaActions.CANCEL_MISSION_REROUTE });
    const handleConfirm = () => jaiaDispatch({ type: JaiaActions.CONFIRM_MISSION_REROUTE });

    const revertDescription = describeRevert(pending.revert);
    const buttons = [
        {
            label: dismissButtonLabel(pending.revert),
            onClick: handleCancel,
        },
    ];
    if (shouldOfferConfirm(pending.revert, hasFeasibleReroute)) {
        buttons.push({ label: "Confirm", onClick: handleConfirm });
    }

    return (
        <ObstacleAvoidanceBaseDialog title="Route Update Required" buttons={buttons}>
            {feasible.length > 0 && (
                <p>
                    Confirming will reroute the mission{feasible.length !== 1 ? "s" : ""} to include{" "}
                    <strong>{pending.totalBypassCount}</strong> bypass waypoint
                    {pending.totalBypassCount !== 1 ? "s" : ""}.
                </p>
            )}

            {feasible.length === 0 && (
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
