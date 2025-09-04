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
import { jaiaAPI, MapsDirectory, Tileset } from "../../utils/jaia-api";
import Icon from "@mdi/react";
import {
    mdiArrowRight,
    mdiCancel,
    mdiContentSave,
    mdiDelete,
    mdiPlus,
    mdiSendVariant,
    mdiUpload,
} from "@mdi/js";
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

function GBString(bytes: number) {
    return (bytes / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " GB";
}

function MBString(bytes: number) {
    return (bytes / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " MB";
}

export function HubMapPanel(props: Props) {
    const [tileDownloader, setTileDownloader] = useState(hubMapDownloader);
    const [error, setError] = useState<string>(null);
    const [mapsDirectory, setMapsDirectory] = useState<MapsDirectory>(
        offlineLayerManager.maps_directory,
    );
    const [selectedOnlineTileLayerIndex, setSelectedOnlineTileLayerIndex] = useState(0);

    // GeoTIFF uploading state
    const [isUploadingGeoTIFF, setIsUploadingGeoTIFF] = useState(false);
    const [geoTIFFBytesUploaded, setGeoTIFFBytesUploaded] = useState(0);
    const [geoTIFFTotalBytes, setGeoTIFFTotalBytes] = useState(0);

    function refreshMapsDirectory() {
        setMapsDirectory(offlineLayerManager.maps_directory);
    }

    useEffect(() => {
        hubMapDownloader.observer = (hubMapDownloader, error) => {
            if (error) {
                setError(error);
                return;
            }

            setTileDownloader(hubMapDownloader);
        };

        offlineLayerManager.subscribe(refreshMapsDirectory, "HubMapPanel");

        return () => {
            hubMapDownloader.observer = null;
            offlineLayerManager.unsubscribe("HubMapPanel");
        };
    }, []);

    // Import GeoTIFF
    async function uploadGeoTIFF(geotiff: File) {
        const reader = geotiff.stream().getReader();
        setIsUploadingGeoTIFF(true);
        setGeoTIFFTotalBytes(geotiff.size);
        let bytesUploaded = 0;
        let chunk_index = 0;

        while (true) {
            const result = await reader.read();
            if (result.done) {
                await jaiaAPI.putOfflineGeoTiffChunk(geotiff.name, chunk_index, new Uint8Array());
                break;
            }

            await jaiaAPI.putOfflineGeoTiffChunk(geotiff.name, chunk_index, result.value);
            bytesUploaded += result.value.length;
            setGeoTIFFBytesUploaded(bytesUploaded);
            setIsUploadingGeoTIFF(true);

            chunk_index += 1;
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

    function geotiffUploadProgressIndicator() {
        const geotiffUploadPercent = isUploadingGeoTIFF
            ? (100 * geoTIFFBytesUploaded) / geoTIFFTotalBytes
            : 0;
        return (
            <div className="geotiff-progress-container">
                <CircularProgress
                    variant="determinate"
                    value={geotiffUploadPercent}
                    size={36}
                    style={{ verticalAlign: "middle", marginLeft: "10pt", marginRight: "10pt" }}
                ></CircularProgress>
                <div>{`Uploading: ${geotiffUploadPercent.toFixed(0)}%`}</div>
            </div>
        );
    }

    // Import Tile Layers (from an online source)
    const tileDownloaderStatusSection = () => {
        const tile = tileDownloader.tileDescriptors.at(0);
        if (!tile) return null;

        if (!tileDownloader.running) return null;

        const remainingTileCount = tileDownloader.tileDescriptors.length;
        const totalTileCount = tileDownloader.completedTiles + remainingTileCount;
        const percent = Math.round((100 * tileDownloader.completedTiles) / totalTileCount);

        return (
            <div className="progress-section">
                <div>
                    <p>{`Importing ${tile.layer_name}`}</p>
                    <p>{`${tileDownloader.completedTiles} / ${totalTileCount} (${percent}%)`}</p>
                </div>
                <button onClick={() => hubMapDownloader.clear()}>Cancel</button>
            </div>
        );
    };

    function importOnlineTileLayer(tileLayer: TileLayer<TileImage>) {
        const layerViewDescriptor = {
            layer: tileLayer,
            view: props.map.getView(),
            max_zoom: 17,
        };

        const tileCount = hubMapDownloader.getTileCount(layerViewDescriptor);
        // We estimate about 11 kB per tile, which is approximately correct for the larger tile file sizes (such as satellite imagery)
        // Other layers may be significantly less, such as Open Street Maps or NOAA ENC tiles.
        const estimatedSize = tileCount * 11000;

        CustomAlert.confirmAsync(
            `Download visible ${tileLayer.get("title")} tiles.\nApproximate download size: ${GBString(estimatedSize)} (${tileCount} tiles).`,
            "Download to Hub",
            "Confirm",
        ).then((confirmed) => {
            if (confirmed) {
                hubMapDownloader.add(layerViewDescriptor);
            }
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

    const deleteLayerFromHub = async (layerName: string) => {
        const message = `Are you sure you want to delete this layer from the Hub?`;
        if (await CustomAlert.confirmAsync(message, "Delete Layer", "Confirm")) {
            await jaiaAPI.deleteHubMap(layerName);
            offlineLayerManager.refresh();
        }
    };

    return (
        <div className="offline-maps-container">
            <div className="geotiff-container">
                <div className="geotiff-select-container">
                    <div className="heading">Upload GeoTIFF to Hub</div>
                    <div onClick={() => clickedImportGeoTIFFButton()}>
                        <Icon path={mdiArrowRight}></Icon>
                    </div>
                </div>
                {isUploadingGeoTIFF ? geotiffUploadProgressIndicator() : null}
            </div>

            <div className="save-tiles-container">
                <div className="heading">Save Map to Hub</div>
                <div className="layer-selection-container">
                    <div className="select-section">
                        <FormControl style={{ width: "200px" }}>
                            <InputLabel>Layer</InputLabel>
                            <Select
                                value={selectedOnlineTileLayerIndex}
                                onChange={(evt) => {
                                    setSelectedOnlineTileLayerIndex(Number(evt.target.value));
                                }}
                                label="Layer"
                            >
                                {menuItems}
                            </Select>
                        </FormControl>
                        <div
                            onClick={() =>
                                importOnlineTileLayer(
                                    onlineTileLayers[selectedOnlineTileLayerIndex],
                                )
                            }
                        >
                            <Icon path={mdiArrowRight}></Icon>
                        </div>
                    </div>

                    {tileDownloaderStatusSection()}
                </div>
            </div>
            <div className="offline-layers-container">
                <div className="heading-container">
                    <div className="heading">Offline Layers</div>
                    <div className="disk-space">
                        Available: {GBString(mapsDirectory?.available_disk_bytes)}
                    </div>
                </div>
                <ul>
                    {mapsDirectory?.maps?.map((tileset) => {
                        return (
                            <li key={tileset.name}>
                                <div>{tileset.name}</div>
                                <div className="size">({MBString(tileset.size)})</div>
                                <div onClick={() => deleteLayerFromHub(tileset.name)}>
                                    <Icon path={mdiDelete}></Icon>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
