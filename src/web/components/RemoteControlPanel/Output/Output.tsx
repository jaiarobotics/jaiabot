import { createTheme, MenuItem, Select, SelectChangeEvent, ThemeProvider } from "@mui/material";

interface RcOutputProps {
    throttleDirection: string;
    throttleMagnitude: number;
    rudderDirection: string;
    rudderMagnitude: number;
}

/**
 * Allows the operator to switch between single and dual analog sticks
 */
export function Output(props: RcOutputProps) {
    return (
        <div>
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
    );
}
