import "./HubMapPanel.less";
import { Button } from "@mui/material";
import OpenFileDialog from "../../jdv/client/src/OpenFileDialog";
import { jaiaAPI } from "../../utils/jaia-api";
import Icon from "@mdi/react";
import { mdiContentSave, mdiUpload } from "@mdi/js";
import { noaaLayer } from "../../openlayers/map/layers/chart-layers";
import { openStreetMapLayer } from "../../openlayers/map/layers/base-layers";
import { HubMapDownloadJob } from "../../openlayers/map/offline-map-download-job";
import { Map } from "ol";

interface Props {
    map: Map;
    hubMapDownloadJob: HubMapDownloadJob;
    setHubMapDownloadJob: (hubMapDownloadJob: HubMapDownloadJob) => void;
}

async function importGeoTiff() {
    OpenFileDialog(".tif", false).then((file_list) => {
        if (file_list.length) {
            const file = file_list.item(0);
            file.bytes().then((uint8array) => {
                const blob = new Blob([uint8array], { type: "application/octet-stream" });
                jaiaAPI.putOfflineGeoTiff(file.name, blob);
            });
        }
    });
}

export function HubMapPanel(props: Props) {
    function downloadOfflineTiles() {
        if (!props.hubMapDownloadJob) {
            const layers = [noaaLayer, openStreetMapLayer];

            const job = new HubMapDownloadJob(props.map, layers);
            job.start(() => {
                if (!props.hubMapDownloadJob.running) {
                    props.setHubMapDownloadJob(null);
                }
            });
            props.setHubMapDownloadJob(job);
        }
    }

    return (
        <div className="hub-map-panel">
            <div className="hub-map-layout-container">
                <div className="hub-map-title">Hub Maps</div>
                <div className="hub-map-section">
                    <Button className="button-jcc" onClick={importGeoTiff}>
                        <Icon path={mdiUpload}></Icon>
                        Upload GeoTiff to Hub...
                    </Button>
                </div>
                <div className="hub-map-section">
                    <Button
                        className="button-jcc"
                        onClick={() => {
                            downloadOfflineTiles();
                        }}
                    >
                        <Icon path={mdiContentSave}></Icon>
                        Save Layers to Hub
                    </Button>
                </div>
            </div>
        </div>
    );
}
