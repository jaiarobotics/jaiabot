import { createTheme, MenuItem, Select, SelectChangeEvent, ThemeProvider } from "@mui/material";

interface Props {
    throttleDirection: string;
    throttleMagnitude: number;
    rudderDirection: string;
    rudderMagnitude: number;
}

/**
 * Dashboard of RC control data
 */
export function Dashboard(props: Props) {
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
