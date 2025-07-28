import { createTheme, MenuItem, Select, SelectChangeEvent, ThemeProvider } from "@mui/material";

interface SelectMenuProps {
    controlType: ControlTypes;
    handleMenuSelection: (event: SelectChangeEvent) => void;
    throttleDirection: string;
    throttleMagnitude: number;
    rudderDirection: string;
    rudderMagnitude: number;
}

// Use string values for MUI compatibility
export enum ControlTypes {
    SINGLE = "SINGLE",
    DUAL = "DUAL",
    DIVE = "DIVE",
}

// Style MUI select menu
const theme = createTheme({
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "white",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "white",
                    },
                },
                notchedOutline: {
                    borderColor: "white",
                    padding: "0px",
                },
            },
        },
    },
});

/**
 * Allows the operator to switch between single and dual analog sticks
 */
export function SelectMenu(props: SelectMenuProps) {
    return (
        <ThemeProvider theme={theme}>
            <div className="rc-dashboard">
                <div className="rc-select-menu">
                    <div className="label">Control:</div>
                    <Select
                        value={props.controlType.toString()}
                        onChange={(event: SelectChangeEvent) => props.handleMenuSelection(event)}
                    >
                        <MenuItem value={ControlTypes.SINGLE}>Single</MenuItem>
                        <MenuItem value={ControlTypes.DUAL}>Dual</MenuItem>
                        <MenuItem value={ControlTypes.DIVE}>Dive</MenuItem>
                    </Select>
                </div>
                <div className="rc-output">
                    <div>Throttle Direction:</div>
                    <div>{props.throttleDirection}</div>
                    <div>Throttle:</div>
                    <div>{props.throttleMagnitude}</div>
                </div>
                <div className="rc-output">
                    <div>Rudder Direction:</div>
                    <div>{props.rudderDirection}</div>
                    <div>Rudder:</div>
                    <div>{props.rudderMagnitude}</div>
                </div>
            </div>
        </ThemeProvider>
    );
}
