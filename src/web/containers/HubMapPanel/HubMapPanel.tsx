import "./HubMapPanel.less";
import { Button } from "@mui/material";
import OpenFileDialog from "../../jdv/client/src/OpenFileDialog";
import { jaiaAPI } from "../../utils/jaia-api";
import Icon from "@mdi/react";
import { mdiCancel, mdiContentSave, mdiDelete, mdiUpload } from "@mdi/js";
import { hubMapDownloader } from "./HubMapDownloader";
import { Map } from "ol";
import { useEffect, useState } from "react";
import TileLayer from "ol/layer/Tile";
import { TileImage } from "ol/source";
import { offlineLayerManager } from "../../openlayers/map/layers/offline-layers";
import { CustomAlert } from "../../shared/CustomAlert";

interface Props {
    map: Map;
}

export function HubMapPanel(props: Props) {
    const [tileDownloader, setTileDownloader] = useState(hubMapDownloader);
    const [error, setError] = useState<string>(null);
    const [layerTitles, setLayerTitles] = useState<string[]>(offlineLayerManager.layerTitles);
    const [checkedLayers, setCheckedLayers] = useState<Set<string>>(new Set());

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

        const offlineLayerObserver = offlineLayerManager.subscribe(refreshLayerList);
        offlineLayerManager.refresh();

        return () => {
            hubMapDownloader.observer = null;
            offlineLayerManager.unsubscribe(offlineLayerObserver);
        };
    });

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
        const hubLayerDivs = offlineLayerManager.layerTitles.map((layerTitle) => {
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

        return <div className="hub-map-section hub-map-layer-list">{hubLayerDivs}</div>;
    };

    const deleteLayerButton = (
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
    );

    // Import GeoTIFF

    async function importGeoTiff() {
        OpenFileDialog(".tif", false)
            .then((file_list) => {
                if (file_list.length) {
                    const file = file_list.item(0);
                    file.bytes().then((uint8array) => {
                        const blob = new Blob([uint8array], { type: "application/octet-stream" });
                        jaiaAPI.putOfflineGeoTiff(file.name, blob);
                    });
                }
            })
            .then(() => {
                offlineLayerManager.refresh();
            });
    }

    const importGeoTIFFButton = (
        <div className="hub-map-section">
            <Button className="button-jcc" onClick={importGeoTiff}>
                <Icon path={mdiUpload}></Icon>
                Upload GeoTiff to Hub...
            </Button>
        </div>
    );

    // Import visible layers

    function importVisibleLayers() {
        props.map
            .getAllLayers()
            .filter((layer) => {
                return layer.isVisible() && layer instanceof TileLayer;
            })
            .forEach((layer: TileLayer<TileImage>) => {
                hubMapDownloader.add({
                    layer: layer,
                    view: props.map.getView(),
                    max_zoom: 17,
                });
            });
    }

    const importTileLayersButton = (
        <div className="hub-map-section">
            <Button
                className="button-jcc"
                onClick={() => {
                    importVisibleLayers();
                }}
            >
                <Icon path={mdiContentSave}></Icon>
                Import visible layers to Hub
            </Button>
        </div>
    );

    /////////////////

    return (
        <div className="hub-map-panel">
            <div className="hub-map-layout-container">
                <div className="hub-map-title">Hub Map Layers</div>
                {hubLayerListSection()}
                {deleteLayerButton}
                {importGeoTIFFButton}
                {importTileLayersButton}
                {tileDownloaderStatusSection()}
                {errorSection()}
            </div>
        </div>
    );
}
