import { MenuItem, Select, SelectChangeEvent, ThemeProvider } from "@mui/material";
import { selectTheme } from "../../../utils/style";

interface SelectMenuProps {
    controlType: ControlTypes;
    handleMenuSelection: (event: SelectChangeEvent) => void;
}

// Use string values for MUI compatibility
export enum ControlTypes {
    SINGLE = "SINGLE",
    DUAL = "DUAL",
    DIVE = "DIVE",
    GAMEPAD = "GAMEPAD",
}

/**
 * Allows the operator to switch between single and dual analog sticks
 */
export function SelectMenu(props: SelectMenuProps) {
    return (
        <ThemeProvider theme={selectTheme}>
            <div className="rc-select-menu">
                <div className="label">Control:</div>
                <Select
                    value={props.controlType.toString()}
                    onChange={(event: SelectChangeEvent) => props.handleMenuSelection(event)}
                >
                    <MenuItem value={ControlTypes.SINGLE}>Single</MenuItem>
                    <MenuItem value={ControlTypes.DUAL}>Dual</MenuItem>
                    <MenuItem value={ControlTypes.DIVE}>Dive</MenuItem>
                    <MenuItem value={ControlTypes.GAMEPAD}>Gamepad</MenuItem>
                </Select>
            </div>
        </ThemeProvider>
    );
}
