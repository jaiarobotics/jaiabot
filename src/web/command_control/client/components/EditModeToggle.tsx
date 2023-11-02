import React from 'react'

import { RunInterface } from "./CommandControl"

import Switch from '@mui/material/Switch'
import { amber } from '@mui/material/colors'
import { alpha, styled } from '@mui/material/styles'
import { FormGroup, FormControlLabel } from '@mui/material'

interface Props {
    onClick: (evt: React.ChangeEvent, run: RunInterface,) => void,
    runIdInEditMode: string
    run: RunInterface
    label: string,
    title: string
}

export default function EditModeToggle(props: Props) {
    // MUI Styling: mui.com/material-ui/react-switch
    const AmberSwitch = styled(Switch)(({ theme }) => ({
        '& .MuiSwitch-switchBase.Mui-checked': {
            color: amber[600],
            '&:hover': {
            backgroundColor: alpha(amber[600], theme.palette.action.hoverOpacity),
            },
        },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
            backgroundColor: amber[600],
        },
        '& .MuiSwitch-switchBase.Mui-checked.Mui-disabled': {
            color: amber[300],
        }        
    }));

    return (
        <FormGroup>
            <FormControlLabel 
                control={
                    <AmberSwitch 
                        checked={props.runIdInEditMode === props.run?.id} 
                        onChange={(evt: React.ChangeEvent) => props.onClick(evt, props.run)}
                    />
                }
                label={props.label} 
                title={props.title}
            />
        </FormGroup>
    )
}
