import React from "react";

import { HealthState } from "../shared/JAIAProtobuf";

interface HealthStatusLineProps {
    healthState: HealthState;
}

export function HealthStatusLine(props: HealthStatusLineProps) {
    const healthClassNames = {
        HEALTH__OK: "healthOK",
        HEALTH__DEGRADED: "healthDegraded",
        HEALTH__FAILED: "healthFailed",
    };

    const healthClassName = healthClassNames[props.healthState] ?? "";

    return (
        <tr>
            <td>Health</td>
            <td>
                <div className={healthClassName}>{props.healthState}</div>
            </td>
        </tr>
    );
}
