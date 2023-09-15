/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react'

// Material Design Icons
import Icon from '@mdi/react'
import { mdiDelete, mdiPlay, mdiFolderOpen, mdiContentSave, mdiFolderUpload } from '@mdi/js'
import Button from '@mui/material/Button';
import { MissionLibraryLocalStorage } from './MissionLibrary';
import { CommandList } from './Missions';
import { MissionInterface } from './CommandControl';

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
        let self = this

        // Mission rows
        let missionNames = this.props.missionLibrary.missionNames()

        let missionNameRows = missionNames.map((name) => {

            var rowClasses = "LoadMissionPanel row hoverable"
            if (name == this.state.selectedMissionName) {
                rowClasses += ' selected'
            }

            let row = (<div key={name} className={rowClasses} onClick={self.didClick.bind(self, name)}>
                {name}
            </div>)

            return row
        })

        // Buttons
        let buttonRow = (<div className="LoadMissionPanel HorizontalFlexbox">
            <Button className="button-jcc" onClick={this.deleteClicked.bind(this)}>
                <Icon path={mdiDelete}></Icon>
            </Button>
            <Button className="button-jcc" onClick={this.uploadClicked.bind(this)}>
                <Icon path={mdiFolderUpload}></Icon>
            </Button>
            <div className='flexSpacer'></div>
            <Button className="button-jcc" onClick={this.cancelClicked.bind(this)}>Cancel</Button>
            <Button className="button-jcc" onClick={this.loadClicked.bind(this)}>Load</Button>
        </div>)

        return (<div className="LoadMissionPanel centered rounded shadowed">
            <div className="LoadMissionPanel title">Load Mission</div>
            <div className="LoadMissionPanel missionList">
                {missionNameRows}
            </div>
            {buttonRow}
        </div>)
    }

    didClick(name: string) {
        this.setState({selectedMissionName: name})
    }

    loadClicked() { 
        if (this.props.areBotsAssignedToRuns() && !confirm('Loading a new mission will delete all runs in the mission. If the current mission is saved, select OK')) {
            return 
        }
        this.props.selectedMission?.(this.props.missionLibrary.loadMission(this.state.selectedMissionName))
    }

    deleteClicked() {
        let name = this.state.selectedMissionName

        if (name == null) {
            return
        }
        
        if (confirm("Are you sure you want to delete the mission named \"" + name + "\"?")) {
            this.props.missionLibrary.deleteMission(name)
            this.state.selectedMissionName = null;
            this.forceUpdate()
        }
    }

    cancelClicked() {
        this.props.onCancel?.()
    }

    uploadClicked() {
        let input = document.createElement('input')
        input.type = 'file'
        input.onchange = _ => {
            let file = input.files[0]

            // setting up the reader
            var reader = new FileReader();
            reader.readAsText(file, 'UTF-8');

            // here we tell the reader what to do when it's done reading...
            reader.onload = readerEvent => {
                var content = readerEvent.target.result as string // this is the content!

                // try to read the mission as JSON
                try {
                    let mission = JSON.parse(content)
                    this.props.selectedMission?.(mission)
                }
                catch (err) {
                    alert("Error: " + err)
                }
            }
        }

        input.click()
    }

}
