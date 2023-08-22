import React from 'react'
import Icon from '@mdi/react'
import Button from '@mui/material/Button'
import OlFeature from 'ol/Feature'
import { Point } from 'ol/geom'
import { mdiClose } from '@mdi/js'
import { PanelType } from './CommandControl'
import { mdiPlay, mdiDelete } from '@mdi/js'
import '../style/components/RallyPointPanel.css'

interface Props {
    selectedRallyFeature: OlFeature<Point>
    goToRallyPoint: (feature: OlFeature<Point>) => void,
    deleteRallyPoint: (feature: OlFeature<Point>) => void,
    setVisiblePanel: (panelType: PanelType) => void,
}

export function RallyPointPanel(props: Props) {
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
                        <Button
                            className={'button-jcc'}
                            onClick={() => props.goToRallyPoint(props.selectedRallyFeature)}
                        >
                            <Icon path={mdiPlay} title='Go To Rally Point'/>
                        </Button>
                        <Button 
                            className={'button-jcc'}
                            onClick={() => props.deleteRallyPoint(props.selectedRallyFeature)}
                        >
                            <Icon path={mdiDelete} title='Clear Mission'/>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}