import CircularProgress from "@mui/material/CircularProgress";
import "./LoadingPanel.less";

/**
 * Rendered prior to RC panel to prevent the operator from sending RC commands
 * before the Bot enters the RC state.
 */
export default function LoadingPanel() {
    return (
        <div className="remote-control-panel loading-panel">
            <div>Entering Remote Control Mode</div>
            <CircularProgress size={72} sx={{ color: "#cc0505" }} />
        </div>
    );
}
