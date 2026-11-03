import { useState } from "react";
import { mdiMapMarkerPath } from "@mdi/js";

import MissionStatusIcon, { StatusLevel } from "../../MissionStatusIcon/MissionStatusIcon";
import MissionRoutingDialog from "./MissionRoutingDialog";

import Mission from "../../../../data/mission_set/mission";
import { RoutingLevel } from "../../../../utils/routing/routing-status";

const STATUSES: Record<RoutingLevel, { level: StatusLevel; label: string }> = {
    [RoutingLevel.CROSSES_ZONE]: { level: "error", label: "the route crosses an exclusion zone" },
    [RoutingLevel.HAS_CLEAR_SUPPRESSED]: {
        level: "warning",
        label: "some suppressed waypoints are clear again",
    },
    [RoutingLevel.CLEAR]: { level: "normal", label: "nothing to do" },
};

interface Props {
    mission: Mission;
    /** The mission's routing level, undefined when it has no waypoints */
    routingLevel: RoutingLevel | undefined;
}

/**
 * A mission's routing status, which opens the mission's routing dialog. Disabled while the
 * mission has no waypoints.
 */
export default function MissionRoutingButton(props: Props) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { routingLevel } = props;
    const { level, label } =
        routingLevel === undefined
            ? { level: "normal" as const, label: "no waypoints" }
            : STATUSES[routingLevel];
    return (
        <>
            <MissionStatusIcon
                level={level}
                iconPath={mdiMapMarkerPath}
                label={`Routing status: ${label}`}
                onClick={() => setIsDialogOpen(true)}
                disabled={routingLevel === undefined}
            />
            {isDialogOpen && (
                <MissionRoutingDialog
                    mission={props.mission}
                    onClose={() => setIsDialogOpen(false)}
                />
            )}
        </>
    );
}
