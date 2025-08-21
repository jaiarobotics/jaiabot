import "./HubMapPanel.less";
import {
    Button,
    InputLabel,
    FormControl,
    Select,
    MenuItem,
    Typography,
    CircularProgress,
} from "@mui/material";
import OpenFileDialog from "../../jdv/client/src/OpenFileDialog";
import { jaiaAPI } from "../../utils/jaia-api";
import Icon from "@mdi/react";
import { mdiCancel, mdiContentSave, mdiDelete, mdiPlus, mdiUpload } from "@mdi/js";
import { hubMapDownloader } from "./HubMapDownloader";
import { Map } from "ol";
import { useEffect, useState } from "react";
import TileLayer from "ol/layer/Tile";
import { TileImage } from "ol/source";
import { offlineLayerManager } from "../../openlayers/map/layers/offline-layers";
import { CustomAlert } from "../../shared/CustomAlert";
import * as Layers from "../../shared/Layers";
import { noaaLayer } from "../../openlayers/map/layers/chart-layers";
import { openStreetMapLayer } from "../../openlayers/map/layers/base-layers";

interface Props {
    map: Map;
}

export function HubMapPanel(props: Props) {
    const [tileDownloader, setTileDownloader] = useState(hubMapDownloader);
    const [error, setError] = useState<string>(null);
    const [layerTitles, setLayerTitles] = useState<string[]>(offlineLayerManager.layerTitles);
    const [checkedLayers, setCheckedLayers] = useState<Set<string>>(new Set());
    const [selectedOnlineTileLayerIndex, setSelectedOnlineTileLayerIndex] = useState(0);

    // GeoTIFF uploading state
    const [isUploadingGeoTIFF, setIsUploadingGeoTIFF] = useState(false);
    const [geoTIFFBytesUploaded, setGeoTIFFBytesUploaded] = useState(0);
    const [geoTIFFTotalBytes, setGeoTIFFTotalBytes] = useState(0);

    function refreshLayerList() {
        setLayerTitles(offlineLayerManager.layerTitles);
    }

    useEffect(() => {
        hubMapDownloader.observer = (hubMapDownloader, error) => {
            if (error) {
                setError(error);
                return;
            }

            setTileDownloader(hubMapDownloader);
        };

        offlineLayerManager.subscribe(refreshLayerList, "refreshLayerList");

        return () => {
            hubMapDownloader.observer = null;
            offlineLayerManager.unsubscribe("refreshLayerList");
        };
    }, []);

    const tileDownloaderStatusSection = () => {
        const tile = tileDownloader.tileDescriptors.at(0);
        if (!tile) return null;

        if (!tileDownloader.running) return null;

        const remainingTileCount = tileDownloader.tileDescriptors.length;
        const totalTileCount = tileDownloader.completedTiles + remainingTileCount;
        const percent = ((100 * tileDownloader.completedTiles) / totalTileCount).toFixed(0);

        return (
            <div className="hub-map-section">
                <div>
                    Tiles: {tileDownloader.completedTiles} / {totalTileCount} ({percent}%)
                </div>
                <div>Layer: {tile.layer_name}</div>
                <Button
                    className="button-jcc"
                    onClick={() => {
                        hubMapDownloader.clear();
                    }}
                >
                    <Icon path={mdiCancel}></Icon>
                    <div className="danger">Cancel Downloads</div>
                </Button>
            </div>
        );
    };

    const errorSection = () => {
        if (error) {
            return <div className="hub-map-section danger">{error}</div>;
        } else return null;
    };

    const hubLayerListSection = () => {
        if (layerTitles.length == 0) {
            return (
                <div className="hub-map-section">
                    <h1>Offline Layers</h1>
                    <p>No offline layers on the hub yet.</p>
                </div>
            );
        }

        const hubLayerDivs = layerTitles.map((layerTitle) => {
            return (
                <div key={layerTitle} className="hub-map-layer-name">
                    <input
                        className="checkbox"
                        type="checkbox"
                        id={layerTitle}
                        name={layerTitle}
                        value={layerTitle}
                        onChange={(event) => {
                            if (event.target.checked) {
                                checkedLayers.add(event.target.value);
                            } else {
                                checkedLayers.delete(event.target.value);
                            }
                            console.log(checkedLayers);
                            setCheckedLayers(checkedLayers);
                        }}
                    />
                    {layerTitle}
                </div>
            );
        });

        return (
            <div className="hub-map-section">
                <h1>Offline Layers</h1>
                <div className="hub-map-layer-list">{hubLayerDivs}</div>
                <Button
                    className="button-jcc danger"
                    onClick={async () => {
                        if (checkedLayers.size == 0) return;

                        const message = `Are you sure you want to delete ${checkedLayers.size} layers from the hub?`;
                        if (
                            await CustomAlert.confirmAsync(
                                message,
                                "Delete Layers",
                                "Delete Layers from Hub",
                            )
                        ) {
                            for (const layerName of checkedLayers) {
                                await jaiaAPI.deleteHubMap(layerName);
                                checkedLayers.delete(layerName);
                            }
                            offlineLayerManager.refresh();
                        }
                    }}
                >
                    <Icon path={mdiDelete} />
                    <div className="danger">Delete Layer(s)</div>
                </Button>
            </div>
        );
    };

    // Import GeoTIFF
    async function uploadGeoTIFF(geotiff: File) {
        const reader = geotiff.stream().getReader();
        setIsUploadingGeoTIFF(true);
        setGeoTIFFTotalBytes(geotiff.size);
        let bytesUploaded = 0;

        while (true) {
            const result = await reader.read();
            if (result.done) {
                await jaiaAPI.putOfflineGeoTiffChunk(geotiff.name, new Uint8Array());
                break;
            }

            await jaiaAPI.putOfflineGeoTiffChunk(geotiff.name, result.value);
            bytesUploaded += result.value.length;
            setGeoTIFFBytesUploaded(bytesUploaded);
            setIsUploadingGeoTIFF(true);
        }
        setIsUploadingGeoTIFF(false);
    }

    async function clickedImportGeoTIFFButton() {
        OpenFileDialog(".tif", false)
            .then((file_list) => {
                if (file_list.length) {
                    uploadGeoTIFF(file_list.item(0));
                }
            })
            .then(() => {
                offlineLayerManager.refresh();
            });
    }

    function geoTiffSection() {
        const geotiffUploadButton = (
            <Button
                className="button-jcc"
                onClick={clickedImportGeoTIFFButton}
                style={{ verticalAlign: "middle" }}
            >
                <Icon path={mdiUpload}></Icon>
                Upload GeoTiff to Hub...
            </Button>
        );

        function geotiffUploadProgressIndicator() {
            const geotiffUploadPercent = isUploadingGeoTIFF
                ? (100 * geoTIFFBytesUploaded) / geoTIFFTotalBytes
                : 0;
            return (
                <div>
                    <CircularProgress
                        variant="determinate"
                        value={geotiffUploadPercent}
                        size={36}
                        style={{ verticalAlign: "middle", marginLeft: "10pt", marginRight: "10pt" }}
                    ></CircularProgress>
                    {`Uploading GeoTIFF: ${geotiffUploadPercent.toFixed(0)}% complete`}
                </div>
            );
        }

        return (
            <div className="hub-map-section" style={{ height: "50pt" }}>
                {isUploadingGeoTIFF ? geotiffUploadProgressIndicator() : geotiffUploadButton}
            </div>
        );
    }

    // Import visible layers

    function importOnlineTileLayer(tileLayer: TileLayer<TileImage>) {
        hubMapDownloader.add({
            layer: tileLayer,
            view: props.map.getView(),
            max_zoom: 17,
        });
    }

    const onlineTileLayers = [
        noaaLayer,
        Layers.getArcGISSatelliteImageryLayer(),
        openStreetMapLayer,
    ];

    const menuItems = onlineTileLayers.map((layer, index) => {
        return (
            <MenuItem value={index} key={index}>
                {layer.get("title")}
            </MenuItem>
        );
    });

    const tileLayerSelectForm = (
        <FormControl style={{ width: "200pt" }}>
            <InputLabel id="demo-simple-select-label">Layer</InputLabel>
            <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={selectedOnlineTileLayerIndex}
                label="Layer"
                onChange={(evt) => {
                    setSelectedOnlineTileLayerIndex(Number(evt.target.value));
                }}
            >
                {menuItems}
            </Select>
        </FormControl>
    );

    const importTileLayersSection = (
        <div className="hub-map-section">
            {tileLayerSelectForm}
            <Button
                className="button-jcc"
                onClick={() => {
                    importOnlineTileLayer(onlineTileLayers[selectedOnlineTileLayerIndex]);
                }}
            >
                <Icon path={mdiPlus}></Icon>
                Import Viewport
            </Button>
        </div>
    );

    function importSection() {
        return (
            <div className="hub-map-section">
                <h1>Import</h1>
                {geoTiffSection()}
                {importTileLayersSection}
                {tileDownloaderStatusSection()}
                {errorSection()}
            </div>
        );
    }

    /////////////////

    return (
        // <div className="hub-map-panel">
        <div className="hub-map-layout-container">
            {importSection()}
            {hubLayerListSection()}
        </div>
        // </div>
    );
}
