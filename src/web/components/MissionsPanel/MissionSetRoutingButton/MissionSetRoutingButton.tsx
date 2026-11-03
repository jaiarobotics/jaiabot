import { useState } from "react";
import { mdiMapMarkerPath } from "@mdi/js";

import MissionStatusIcon, { StatusLevel } from "../MissionStatusIcon/MissionStatusIcon";
import MissionSetRoutingDialog from "./MissionSetRoutingDialog";

import { getWorstRoutingLevel, RoutingLevel } from "../../../utils/routing/routing-status";

const STATUSES: Record<RoutingLevel, { level: StatusLevel; label: string }> = {
    [RoutingLevel.CROSSES_ZONE]: { level: "error", label: "a route crosses an exclusion zone" },
    [RoutingLevel.HAS_CLEAR_SUPPRESSED]: {
        level: "warning",
        label: "some missions have suppressed waypoints that are clear again",
    },
    [RoutingLevel.CLEAR]: { level: "normal", label: "nothing to do" },
};

interface Props {
    /** Each mission's routing level by mission ID, undefined for a mission with no waypoints */
    routingLevels: ReadonlyMap<number, RoutingLevel | undefined>;
}

/**
 * The most urgent routing status across a mission set, which opens the mission set's routing
 * dialog. Disabled while no mission has waypoints.
 */
export default function MissionSetRoutingButton(props: Props) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const routingLevel = getWorstRoutingLevel(props.routingLevels.values());
    const { level, label } =
        routingLevel === undefined
            ? { level: "normal" as const, label: "no waypoints" }
            : STATUSES[routingLevel];
    return (
        <>
            <MissionStatusIcon
                level={level}
                iconPath={mdiMapMarkerPath}
                label={`Mission set routing status: ${label}`}
                onClick={() => setIsDialogOpen(true)}
                disabled={routingLevel === undefined}
            />
            {isDialogOpen && <MissionSetRoutingDialog onClose={() => setIsDialogOpen(false)} />}
        </>
    );
}
