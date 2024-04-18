import React from 'react'

import { PortalHubStatus } from '../jcc/client/components/shared/PortalStatus'

interface HealthStatusLineProps {
    hubStatus: PortalHubStatus
}

export function HealthStatusLine(props: HealthStatusLineProps) {
    const healthClassNames = {
        'HEALTH__OK': 'healthOK',
        'HEALTH__DEGRADED': 'healthDegraded',
        'HEALTH__FAILED': 'healthFailed'
    }

    const healthClassName = healthClassNames[props.hubStatus?.health_state] ?? ''

    return (
        <tr>
            <td>Health</td>
            <td>
                <div className={healthClassName}>{props.hubStatus?.health_state}</div>
            </td>
        </tr>
    )
}