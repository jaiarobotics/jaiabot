import React from 'react'
import Icon from '@mdi/react'
import OlFeature from 'ol/Feature'
import { Point } from 'ol/geom'
import { mdiClose } from '@mdi/js'
import { PanelType } from './CommandControl'
import '../style/components/RallyPointPanel.css'

interface Props {
    selectedRallyFeature: OlFeature<Point>
    goToRallyPoint: (feature: OlFeature<Point>) => void
    setVisiblePanel: (panelType: PanelType) => void,
}

export function RallyPointPanel(props: Props) {
    console.log(props.selectedRallyFeature.getKeys())
    return (
        <div className="rally-base-grid">
            <div className="rally-layout-container">
                <div className='rally-close-btn' onClick={() => {
                    props.setVisiblePanel(PanelType.NONE)
                }}>
                    <Icon path={mdiClose} size={1} />
                </div>
                <div className="rally-outer-container">
                    <div className="rally-container">
                        <div className="rally-title">Rally: {props.selectedRallyFeature.get('romanNum')}</div>
                        <button className="rally-btn rally-go" onClick={() => props.goToRallyPoint(props.selectedRallyFeature)}>Go</button>
                        <button className="rally-btn rally-delete">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    )
}