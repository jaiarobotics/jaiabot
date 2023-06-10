import React from 'react'

// Material Design Icons
import Icon from '@mdi/react'
import { mdiDelete, mdiPlay, mdiFolderOpen, mdiContentSave, mdiFolderUpload } from '@mdi/js'
import Button from '@mui/material/Button'
import { MissionLibraryLocalStorage } from './MissionLibrary'
import { CommandList } from './Missions'
import { MissionInterface } from './CommandControl'

interface Props {
    missionLibrary: MissionLibraryLocalStorage
    selectedMission: (mission: MissionInterface) => void
    onCancel: () => void
    areBotsAssignedToRuns: () => boolean
}

interface State {
    selectedMissionName: string | null
}

export class LoadMissionPanel extends React.Component {
    props: Props
    state: State

    constructor(props: Props) {
        super(props)

        this.state = {
            selectedMissionName: null
        }
    }

    render() {
        // Mission rows
        const missionNames = this.props.missionLibrary.missionNames()
        const missionNameRows = missionNames.map((name) => {
            let rowClasses = 'LoadMissionPanel row hoverable'
            if (name == this.state.selectedMissionName) {
                rowClasses += ' selected'
            }

            const row = (
                <div key={name} className={rowClasses} onClick={this.didClick.bind(this, name)}>
                    {name}
                </div>
            )

            return row
        })

        // Buttons
        const buttonRow = (
            <div className='LoadMissionPanel HorizontalFlexbox'>
                <Button className='button-jcc' onClick={this.deleteClicked.bind(this)}>
                    <Icon path={mdiDelete}></Icon>
                </Button>
                <Button className='button-jcc' onClick={this.uploadClicked.bind(this)}>
                    <Icon path={mdiFolderUpload}></Icon>
                </Button>
                <div className='flexSpacer'></div>
                <Button className='button-jcc' onClick={this.cancelClicked.bind(this)}>
                    Cancel
                </Button>
                <Button className='button-jcc' onClick={this.loadClicked.bind(this)}>
                    Load
                </Button>
            </div>
        )

        return (
            <div className='LoadMissionPanel centered rounded shadowed'>
                <div className='LoadMissionPanel title'>Load Mission</div>
                <div className='LoadMissionPanel missionList'>{missionNameRows}</div>
                {buttonRow}
            </div>
        )
    }

    didClick(name: string) {
        this.setState({ selectedMissionName: name })
    }

    loadClicked() {
        if (
            this.props.areBotsAssignedToRuns() &&
            !confirm(
                'Loading a new mission will delete all runs in the mission. If the current mission is saved, select OK'
            )
        ) {
            return
        }
        this.props.selectedMission?.(
            this.props.missionLibrary.loadMission(this.state.selectedMissionName)
        )
    }

    deleteClicked() {
        const name = this.state.selectedMissionName

        if (name == null) {
            return
        }

        if (confirm('Are you sure you want to delete the mission named "' + name + '"?')) {
            this.props.missionLibrary.deleteMission(name)
            this.state.selectedMissionName = null
            this.forceUpdate()
        }
    }

    cancelClicked() {
        this.props.onCancel?.()
    }

    uploadClicked() {
        const input = document.createElement('input')
        input.type = 'file'
        input.onchange = (_) => {
            const file = input.files[0]

            // setting up the reader
            const reader = new FileReader()
            reader.readAsText(file, 'UTF-8')

            // here we tell the reader what to do when it's done reading...
            reader.onload = (readerEvent) => {
                const content = readerEvent.target.result as string // this is the content!

                // try to read the mission as JSON
                try {
                    const mission = JSON.parse(content)
                    this.props.selectedMission?.(mission)
                } catch (err) {
                    alert('Error: ' + err)
                }
            }
        }

        input.click()
    }
}
