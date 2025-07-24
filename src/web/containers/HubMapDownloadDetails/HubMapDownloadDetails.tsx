import { Button } from "@mui/material";
import { HubMapDownloadJob } from "../../openlayers/map/offline-map-download-job";
import "./HubMapDownloadDetails.less";

interface Props {
    job: HubMapDownloadJob;
    onCancel: (evt: any) => void;
}

export function HubMapDownloadDetails(props: Props) {
    const percent = ((100.0 * props.job.completed_tile_count) / props.job.tile_count).toFixed(0);

    return (
        <div className="offline-map-download-details centered shadowed rounded">
            <div>Offline Maps</div>
            <div>
                {`Download progress: ${props.job.completed_tile_count} / ${props.job.tile_count} tiles (${percent}%)`}
            </div>
            <Button onClick={props.onCancel} className="button-jcc">
                <div className="danger">Cancel Download</div>
            </Button>
        </div>
    );
}
