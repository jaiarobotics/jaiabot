import React from 'react'
import Button from '@mui/material/Button'
import Icon from '@mdi/react'
import { PortalBotStatus } from '../PortalStatus'
import RunItem from './RunItem'
import { MissionInterface } from '../CommandControl'
import { mdiPlus, mdiDelete, mdiFolderOpen, mdiContentSave, mdiAutoFix } from '@mdi/js'
import { Missions } from '../Missions'

interface Props {
    bots: { [key: number]: PortalBotStatus }
    mission: MissionInterface
    loadMissionClick: any
    saveMissionClick: any
    deleteAllRunsInMission: any
    autoAssignBotsToRuns: any
}

interface State {}

export default class RunList extends React.Component {
    props: Props
    state: State

    constructor(props: Props) {
        super(props)

        this.state = {}
    }

    render() {
        let self = this

        return (
            <React.Fragment>
                <div id='runList'>
                    {Object.entries(this.props?.mission?.runs).map(([key, value]) => (
                        <React.Fragment key={key}>
                            <RunItem
                                bots={self.props.bots}
                                run={value}
                                mission={self.props.mission}
                            />
                        </React.Fragment>
                    ))}
                </div>
                <Button
                    className='button-jcc'
                    id='add-run'
                    onClick={() => {
                        Missions.addRunWithWaypoints(-1, [], this.props.mission)
                    }}
                >
                    <Icon path={mdiPlus} title='Add Run' />
                </Button>
                <Button
                    className='button-jcc'
                    onClick={() => {
                        const warning_string = 'Are you sure you want to delete all of the runs?'

                        if (confirm(warning_string)) {
                            this.props.deleteAllRunsInMission(this.props.mission)
                        }
                    }}
                >
                    <Icon path={mdiDelete} title='Clear Mission' />
                </Button>
                <Button
                    className='button-jcc'
                    onClick={() => {
                        this.props.loadMissionClick()
                    }}
                >
                    <Icon path={mdiFolderOpen} title='Load Mission' />
                </Button>
                <Button
                    className='button-jcc'
                    onClick={() => {
                        this.props.saveMissionClick()
                    }}
                >
                    <Icon path={mdiContentSave} title='Save Mission' />
                </Button>
                <Button
                    className='button-jcc'
                    onClick={() => {
                        this.props.autoAssignBotsToRuns()
                    }}
                >
                    <Icon path={mdiAutoFix} title='Auto Assign Bots' />
                </Button>
            </React.Fragment>
        )
    }
}
