import React, { useEffect } from 'react'

import { RunInterface } from '../CommandControl';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';

interface Props {
    handleBotSelectionChange: (evt: SelectChangeEvent) => void
    run: RunInterface
    botsNotAssigned: number[]
}

export default function RunAssignMenu(props: Props) {
    useEffect(() => {
        props.botsNotAssigned ?? []
    }, [])

    const getAssignedOption = () => {
        // Check to see if the run is assigned
        // And if the bot id is not included in the botsNotAssigned array
        if (props.run.assigned !== -1 && !props.botsNotAssigned.includes(props.run.assigned)) {
            return (
                <MenuItem 
                    key={props.run.assigned} 
                    value={props.run.assigned}
                >
                    {`Bot-${props.run.assigned}`}
                </MenuItem> 
            )
        }
        return <div></div>
    }

    return (
        <Box sx={{ minWidth: 120 }}>
            <FormControl fullWidth>
            <InputLabel id="bot-assigned-select-label">Id</InputLabel>
                <Select
                    labelId="bot-assigned-select-label"
                    id="bot-assigned-select"
                    value={props.run?.assigned?.toString()}
                    label="Assign"
                    onChange={(evt: SelectChangeEvent) => props.handleBotSelectionChange(evt)}
                >
                    <MenuItem key={-1} value={-1}>Unassigned</MenuItem>
                    {getAssignedOption()}   
                    {
                        props.botsNotAssigned.map((id) => {
                            return <MenuItem key={id} value={id}>{`Bot-${id}`}</MenuItem>
                        })
                    }
                </Select>
            </FormControl>
        </Box>
    )
}
