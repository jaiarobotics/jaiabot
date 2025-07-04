import { Button } from "@mui/material";
import { OfflineMapDownloadJob } from "../../openlayers/map/layers/tile-db";
import "./OfflineMapDownloadDetails.less";

interface Props {
    job: OfflineMapDownloadJob;
    onCancel: (evt: any) => void;
}

export function OfflineMapDownloadDetails(props: Props) {
    const percent = ((100.0 * props.job.completed_urls) / props.job.url_list.length).toFixed(0);

    return (
        <div className="offline-map-download-details centered shadowed rounded">
            <div>Offline Maps</div>
            <div>
                {`Download progress: ${props.job.completed_urls} / ${props.job.url_list.length} tiles (${percent}%)`}
            </div>
            <Button onClick={props.onCancel} className="button-jcc">
                <div className="danger">Cancel Download</div>
            </Button>
        </div>
    );
}
