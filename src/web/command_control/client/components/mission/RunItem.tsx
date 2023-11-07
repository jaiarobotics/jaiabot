import React from 'react';

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
import { jaiaAPI } from '../../../common/JaiaAPI';
import { CustomAlert } from '../shared/CustomAlert';
import { RunInterface } from '../CommandControl';
import { deepcopy, addDropdownListener } from '../shared/Utilities';

type RunItemProps = {
    botIds: number[]
    botsNotAssignedToRuns: number[]
    runIdInEditMode: string
    run: RunInterface
    openRunPanels: {[runId: string]: boolean}
    setOpenRunPanels: (runPanels: {[runId: string]: boolean}) => void
    handleBotAssignChange: (prevBotId: number, newBotId: number, runId: string) => void
    unSelectHubOrBot: () => void
    addDuplicateRun: (goals: Goal[]) => void
    deleteSingleRun: (runId: string) => void
    toggleEditMode: (evt: React.ChangeEvent, run: RunInterface) => boolean
}

type RunItemState = {}

export default class RunItem extends React.Component<RunItemProps, RunItemState> {
    nonActiveRunStates = ['PRE_DEPLOYMENT', 'RECOVERY', 'STOPPED', 'POST_DEPLOYMENT']

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

    handleDuplicateRunClick(evt: React.MouseEvent<HTMLButtonElement>) {
        this.props.unSelectHubOrBot()
        const goals = deepcopy(this.props.run.command.plan.goal)
        this.props.addDuplicateRun(goals)
    }

    handleDeleteRunClick() {
        
    }

    render() {
        let editModeButton = null
        let title = this.props.run.name
        let plan = this.props.run.command.plan
        let repeats = plan?.repeats ?? 1

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
                        <Typography className="title">
                            {title}
                        </Typography>
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
                                onClick={(evt) => this.handleDuplicateRunClick(evt)}
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
                            Repeats: {repeats}
                            <Slider
                                id="runRepeats"
                                aria-label="Repeats"
                                value={repeats}
                                valueLabelDisplay="auto"
                                step={1}
                                marks
                                min={1}
                                max={10}
                                onChange={(evt: Event, value: number, activeThumb: number) => {
                                    if (plan != null) {
                                        plan.repeats = value
                                        this.forceUpdate() // Force update, because I don't want to add repeats to the State. I want a single source of truth.
                                    }
                                }}
                            />
                        </div>
                    </AccordionDetails>
                </Accordion>
            </ThemeProvider>
        )
    }
}