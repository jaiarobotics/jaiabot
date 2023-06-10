import React from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Button from '@mui/material/Button'
import Icon from '@mdi/react'
import { mdiDelete, mdiContentDuplicate } from '@mdi/js'
import { PortalBotStatus } from '../PortalStatus'
import { RunInterface, MissionInterface } from '../CommandControl'
import Switch from '@mui/material/Switch'
import Box from '@mui/material/Box'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import { Missions } from '../Missions'
import { Slider } from '@mui/material'

interface Props {
    bots: { [key: number]: PortalBotStatus }
    run: RunInterface
    mission: MissionInterface
}

interface State {
    editing: boolean
}

export default class RunItem extends React.Component {
    props: Props
    state: State
    botId: number | null
    botsNotAssigned: number[]

    constructor(props: Props) {
        super(props)

        this.state = {
            editing: false
        }
    }

    render() {
        let runDeleteButton = null
        let runAssignSelect = null
        let duplicateRunButton = null
        const title = this.props.run.name
        const podStatusBotIds = Object.keys(this.props.bots)
        const botsAssignedToRunsIds = Object.keys(this.props.mission.botsAssignedToRuns)
        this.botsNotAssigned = []
        let assignedLabel = ''
        let assignedOption = null

        // Find the difference between the current botIds available
        // And the bots that are already assigned to get the ones that
        // Have not been assigned yet
        podStatusBotIds.forEach((key) => {
            if (!botsAssignedToRunsIds.includes(key)) {
                const id = Number(key)
                if (isFinite(id)) {
                    this.botsNotAssigned.push(id)
                }
            }
        })

        // Check to see if that run is assigned
        // And the bot id is not included in the botsNotAssigned array
        if (
            this.props.run.assigned != -1 &&
            !this.botsNotAssigned.includes(this.props.run.assigned)
        ) {
            assignedLabel = 'Bot-' + this.props.run.assigned
            assignedOption = (
                <MenuItem key={this.props.run.assigned} value={this.props.run.assigned}>
                    {assignedLabel}
                </MenuItem>
            )
        }

        // Create the Select Object
        runAssignSelect = (
            <Box sx={{ minWidth: 120 }}>
                <FormControl fullWidth>
                    <InputLabel id='bot-assigned-select-label'>Id</InputLabel>
                    <Select
                        labelId='bot-assigned-select-label'
                        id='bot-assigned-select'
                        value={this.props.run.assigned.toString()}
                        label='Assign'
                        onChange={this.assignChange}
                    >
                        <MenuItem key={-1} value={-1}>
                            Unassigned
                        </MenuItem>

                        {assignedOption ? (
                            <MenuItem key={this.props.run.assigned} value={this.props.run.assigned}>
                                {assignedLabel}
                            </MenuItem>
                        ) : (
                            ''
                        )}

                        {this.botsNotAssigned
                            ? Object.keys(this.botsNotAssigned).map((id) => (
                                  <MenuItem
                                      key={this.botsNotAssigned[Number(id)]}
                                      value={this.botsNotAssigned[Number(id)]}
                                  >
                                      Bot-{this.botsNotAssigned[Number(id)]}
                                  </MenuItem>
                              ))
                            : ''}
                    </Select>
                </FormControl>
            </Box>
        )

        // Create Delete Button
        runDeleteButton = (
            <Button
                className={'button-jcc missionAccordian'}
                onClick={(event) => {
                    event.stopPropagation()

                    const warning_string =
                        'Are you sure you want to delete ' + this.props.run.name + '?'

                    if (confirm(warning_string)) {
                        //Deep copy
                        const mission = this.props.mission

                        delete mission?.runs[this.props.run.id]

                        delete mission?.botsAssignedToRuns[this.props.run.assigned]
                    }
                }}
            >
                <Icon path={mdiDelete} title='Delete Run' />
            </Button>
        )

        // Create Copy of Run Button
        duplicateRunButton = (
            <Button
                className={'button-jcc missionAccordian'}
                onClick={(event) => {
                    event.stopPropagation()
                    Missions.addRunWithGoals(
                        -1,
                        this.props.run.command.plan.goal,
                        this.props.mission
                    )
                }}
            >
                <Icon path={mdiContentDuplicate} title='Duplicate Run' />
            </Button>
        )

        // Create Edit Toggle
        const edit = (
            <Switch
                checked={this.state.editing}
                onChange={this.editUpdate.bind(this)}
                inputProps={{ 'aria-label': 'controlled' }}
            />
        )

        const plan = this.props.run.command.plan
        const repeats = plan?.repeats ?? 1
        const repeatsInput = (
            <div>
                Repeats: {repeats}
                <Slider
                    id='runRepeats'
                    aria-label='Repeats'
                    value={repeats}
                    valueLabelDisplay='auto'
                    step={1}
                    marks
                    min={1}
                    max={10}
                    onChange={(evt: Event, value: number, activeThumb: number) => {
                        if (plan != null) {
                            plan.repeats = value
                            this.forceUpdate() // Force update, because I don't want to add repeats to the State.  I want a single source of truth.
                        }
                    }}
                />
            </div>
        )

        return (
            <Accordion className='run-accordian'>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls='panel1a-content'
                    id='panel1a-header'
                >
                    <Typography className='title'>{title}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <span className='runItemInfo'>
                        {runAssignSelect}
                        {duplicateRunButton}
                        {/*edit*/}
                        {runDeleteButton}
                    </span>
                    <div>{repeatsInput}</div>
                </AccordionDetails>
            </Accordion>
        )
    }

    editUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
        this.props.run.editing = event.target.checked
    }

    assignChange = (event: SelectChangeEvent) => {
        const value = Number(event.target.value)

        if (isFinite(value)) {
            // Delete bot assignment if changed from previous
            if (value != this.props.run.assigned) {
                delete this.props.mission.botsAssignedToRuns[this.props.run.assigned]
            }

            // Change run assignment for run to bot
            this.props.run.assigned = value
            this.props.run.command.bot_id = value
            this.props.mission.botsAssignedToRuns[this.props.run.assigned] = this.props.run.id
        }
    }
}
