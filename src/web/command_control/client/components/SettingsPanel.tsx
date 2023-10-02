import React from 'react'
import WptToggle from './WptToggle'
import { taskData } from './TaskPackets'
import '../style/components/SettingsPanel.css'

interface Props {
    isClusterModeOn: boolean
    setClusterModeStatus: (isOn: boolean) => void
}

export function SettingsPanel(props: Props) {
    const getClusterModeStatus = () => {
        return props.isClusterModeOn
    }

    const handleClusterToggleClick = () => {
        // Task packets within this distance (meters) will be clustered
        const defaultDistance = 30

        if (props.isClusterModeOn) {
            taskData.updateClusterDistance(0)
        } else {
            taskData.updateClusterDistance(defaultDistance)
        }

        props.setClusterModeStatus(!props.isClusterModeOn)
    }

    return (
        <div className="settings-outer-container">
			<div className="panel-heading">Settings</div>
            <div className="settings-inner-container">
                <div className="settings-card">
                    <div className="settings-label">Task Packet Clusters</div>
                    <WptToggle 
                        checked={getClusterModeStatus}
                        onClick={handleClusterToggleClick}
                    />
                </div>
            </div>
        </div>
    )
}
