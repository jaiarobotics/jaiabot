import React, { ChangeEvent } from 'react';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Button from '@mui/material/Button';
import { SelectChangeEvent } from '@mui/material/Select';
import { Slider, ThemeProvider, createTheme } from '@mui/material';

import Icon from '@mdi/react'
import { mdiDelete, mdiContentDuplicate } from '@mdi/js'

import RunAssignMenu from './RunAssignMenu';
import EditModeToggle from '../EditModeToggle';
import { Goal } from '../shared/JAIAProtobuf';
import { RunInterface } from '../CommandControl';
import { deepcopy, addDropdownListener } from '../shared/Utilities';
import { jaiaAPI } from '../../../common/JaiaAPI';
import '../../style/components/RunItem.less'
import JaiaToggle from '../JaiaToggle'

type RunItemProps = {
    botIds: number[]
    botsNotAssignedToRuns: number[]
    runIdInEditMode: string
    run: RunInterface
    openRunPanels: {[runId: string]: boolean}
    setOpenRunPanels: (runPanels: {[runId: string]: boolean}) => void
    handleBotAssignChange: (prevBotId: number, newBotId: number, runId: string) => void
    unSelectHubOrBot: () => void
    addDuplicateRun: (run: RunInterface) => void
    deleteSingleRun: (runId: string) => void
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
    toggleShowTableOfWaypoints: (runId: string) => void
}

type RunItemState = {
}


export default class RunItem extends React.Component<RunItemProps, RunItemState> {
    nonActiveRunStates = ['PRE_DEPLOYMENT', 'RECOVERY', 'STOPPED', 'POST_DEPLOYMENT']

    /**
     * Checks if the table of waypoints is currently shown.
     * 
     * @returns {boolean} True if the table of waypoints is shown, false otherwise.
     */
    isWptToggled(){
        return this.props.run.showTableOfWaypoints;
    }

    /**
     * Toggles the display state of the table of waypoints.
     * 
     * @returns {void}
     */
    toggleWpt(){
        this.props.toggleShowTableOfWaypoints(this.props.run.id);
    }


    makeAccordionTheme() {
        return createTheme({
            transitions: {
                create: () => 'none',
            }
        })
    }

    componentDidMount() {
        addDropdownListener('run-accordion', 'runList', 30) // 30 seems to be sufficent time for dropdown to establish its height
    }
    
    handleBotSelectionChange(event: SelectChangeEvent) {
        const newBotId = Number(event.target.value)
        this.props.handleBotAssignChange(this.props.run.assigned, newBotId, this.props.run.id)
    }

    isRunPanelOpen() {
        return this.props.openRunPanels[this.props.run.id] ?? false
    }

    handleOpenCloseClick() {
        this.props.openRunPanels[this.props.run.id] = !this.props.openRunPanels[this.props.run.id]
        this.props.setOpenRunPanels(this.props.openRunPanels)
    }

    /**
     * On user click the current run will be copied and 
     * a new run will be created from this copied run
     * so that we can have multiple bots with the same run
     * 
     * @returns {void}
     * 
     * @notes
     * The new run will be unassigned by default
     */
    handleDuplicateRunClick() {
        this.props.unSelectHubOrBot()
        this.props.addDuplicateRun(this.props.run)
    }

    getBotName() {
        if (this.props.run.assigned !== -1) {
            return `Bot ${this.props.run.assigned}`
        }
        else {
            return 'Unassigned'
        }
    }

    render() {
        let title = this.props.run.name
        let plan = this.props.run.command.plan
        let repeats = plan?.repeats ?? 1
        let repeatsInput = (
            <div className='repeats-input'>
                <div>Repeats (1-100)</div>
                <input type="number" className='NumberInput' id="repeats" name="repeats" min="1" max="100" value={repeats} onChange={
                    (evt: ChangeEvent<HTMLInputElement>) => {
                        if (plan != null) {
                            plan.repeats = Math.max(1, Math.min(evt.target.valueAsNumber, 100))
                            // Force update, because I don't want to add repeats to the State. I want a single source of truth.
                            this.forceUpdate() 
                        }
                    }
                } />
            </div>
        )

        return (
            <ThemeProvider theme={this.makeAccordionTheme()}>
                <Accordion 
                    id={`run-accordion-${this.props.run.id.split('-')[1]}`}
                    className="run-accordion"
                    expanded={this.isRunPanelOpen()}
                    onChange={() => this.handleOpenCloseClick()}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel1a-content"
                        id="panel1a-header"
                    >
                    <div className='runTitleBar'>
                        <Typography className="title">
                            {this.props.run.name}
                        </Typography>
                        <div className='botName'>
                            {this.getBotName()}
                        </div>
                    </div>
                    </AccordionSummary>
                    <AccordionDetails>
                        <span className="runItemInfo">
                            <RunAssignMenu
                                handleBotSelectionChange={this.handleBotSelectionChange.bind(this)}
                                run={this.props.run}
                                botsNotAssigned={this.props.botsNotAssignedToRuns}
                            />
                            <Button 
                                className={'button-jcc missionAccordian'}
                                onClick={() => this.handleDuplicateRunClick()}
                            >
                                <Icon path={mdiContentDuplicate} title="Duplicate Run"/>
                            </Button>
                            <Button 
                                className={`button-jcc missionAccordian`}
                                onClick={() => this.props.deleteSingleRun(this.props.run.id)}
                            >
                                <Icon path={mdiDelete} title="Delete Run"/>
                            </Button>
                            <EditModeToggle 
                                onClick={this.props.toggleEditMode}
                                runIdInEditMode={this.props.runIdInEditMode}
                                run={this.props.run}
                                label="Edit"
                                title="ToggleEditMode"
                            />
                        </span>
                        <div>
                            {repeatsInput}
                        </div>

                        <JaiaToggle 
                        checked={() => this.isWptToggled()}
                        onClick={() => this.toggleWpt()}
                        title="Show Wpts"
                        label="Show Wpts"
                        />

                        {
                            this.props.run.showTableOfWaypoints && 
                            <table className="table-container">
                            <thead>
                                <tr>
                                    <th>
                                        Wpt Id
                                    </th>
                                    <th>
                                        Lat
                                    </th>
                                    <th>
                                        Lon
                                    </th>
                                    <th>
                                        Task
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    this.props.run.command.plan.goal.map((item,index)=>(
                                        <tr key={index}>
                                        <td>
                                            {index + 1}
                                        </td>
                                        <td>
                                            {item.location.lat.toFixed(5)}
                                        </td>
                                        <td>
                                            {item.location.lon.toFixed(5)}
                                        </td>   
                                        <td>
                                            {item.task?.type?item.task.type:"None"}
                                        </td>
                                    </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                        }
                        
                    </AccordionDetails>
                </Accordion>
            </ThemeProvider>
        )
    }
}