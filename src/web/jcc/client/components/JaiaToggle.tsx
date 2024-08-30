import React from "react";
import Switch from "@mui/material/Switch";
import { FormGroup, FormControlLabel } from "@mui/material";
import { amber } from "@mui/material/colors";
import { alpha, styled } from "@mui/material/styles";

interface Props {
    checked: () => boolean;
    onClick: () => void;
    disabled?: () => boolean;
    label?: string;
    title?: string;
}

// MUI Styling: mui.com/material-ui/react-switch
const AmberSwitch = styled(Switch)(({ theme }) => ({
    "& .MuiSwitch-switchBase.Mui-checked": {
        color: amber[600],
        "&:hover": {
            backgroundColor: alpha(amber[600], theme.palette.action.hoverOpacity),
        },
    },
    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
        backgroundColor: amber[600],
    },
    "& .MuiSwitch-switchBase.Mui-checked.Mui-disabled": {
        color: amber[300],
    },
}));

export default function JaiaToggle(props: Props) {
    return (
        <FormGroup>
            <FormControlLabel
                control={
                    <AmberSwitch
                        checked={props.checked()}
                        disabled={props?.disabled ? props.disabled() : false}
                        onClick={() => props.onClick()}
                        inputProps={{
                            data-testid: "taskSelectInput"
                        }}
                    />
                }
                label={props?.label ? props.label : ""}
                title={props?.title ? props.title : ""}
            />
        </FormGroup>
    );
}
