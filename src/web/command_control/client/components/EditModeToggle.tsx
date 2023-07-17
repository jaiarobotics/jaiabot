import React from "react"
import Switch from '@mui/material/Switch';
import { FormGroup, FormControlLabel } from '@mui/material';
import { amber } from '@mui/material/colors';
import { alpha, styled } from '@mui/material/styles';
import { RunInterface } from "./CommandControl";

interface Props {
    checked: (run: RunInterface) => boolean,
    onClick: (run: RunInterface) => void,
    disabled?: (run: RunInterface) => boolean,
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
                        checked={props.checked(props.run)} 
                        disabled={props.disabled ? props.disabled(props.run) : false} 
                        onClick={() => props.onClick(props.run)}
                    />
                }
                label={props.label} 
                title={props.title}
            />
        </FormGroup>
    )
}
