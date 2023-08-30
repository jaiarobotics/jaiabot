import React from 'react'
import Icon from '@mdi/react'
import { mdiClose } from '@mdi/js'

import { PanelType } from './CommandControl'
import '../style/components/RunInfoPanel.css'

interface Props {
    setVisiblePanel: (panelType: PanelType) => void,
    runNum: number,
    botId: number
    canDeleteRun: boolean
    deleteRun: (runNum: number) => void
}

export default function RunInfoPanel(props: Props) {
    let deleteButton = null
    if (props.canDeleteRun) {
        deleteButton = <button className="run-info-btn" onClick={() => handleDeleteRunClick()}>Delete Run</button>
    }

    const handleDeleteRunClick = () => {
        props.deleteRun(props.runNum)
        props.setVisiblePanel(PanelType.NONE)
    }

    return (
        <div className="run-info-panel-base-grid">
            <div className="run-info-layout-container">
                <div className='run-info-close-btn' onClick={() => {
                    props.setVisiblePanel(PanelType.NONE)
                }}>
                    <Icon path={mdiClose} size={1} />
                </div>
                <div className="run-info-outer-container">
                    <div className="run-info-title">Quick Look</div>
                    <div className="run-info-panel-container">
                        <div className="run-info-label">Run:</div>
                        <div className="run-info-input">{props.runNum}</div>
                        <div className="run-info-line-break"></div>
                        <div className="run-info-label">Bot:</div>
                        <div className="run-info-input">{props.botId}</div>
                        <div className="run-info-line-break"></div>
                        {deleteButton}
                    </div>
                </div>
            </div>
        </div>
    )
}
