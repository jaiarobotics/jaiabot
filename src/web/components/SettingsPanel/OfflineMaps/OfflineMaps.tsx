import { useState } from "react";
import Icon from "@mdi/react";
import { mdiArrowRight, mdiDelete } from "@mdi/js";
import {
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
} from "@mui/material";
import TileLayer from "ol/layer/Tile";
import { TileImage } from "ol/source";
import { view } from "../../../openlayers/views/view";
import { layers } from "../../../openlayers/layers/layers";
import { offlineLayerManager } from "../../../openlayers/layers/offline/offline-layer-manager";
import { LayerTitles } from "../../../types/openlayers-types";
import { jaiaAPI } from "../../../utils/jaia-api";
import { openFileDialog } from "../../../utils/file";
import "./OfflineMaps.less";

interface UploadProps {
    isUploading: boolean;
    bytesUploaded: number;
    totalBytes: number;
}

const ONLINE_TILE_LAYERS: LayerTitles[] = [
    LayerTitles.OSM_LAYER,
    LayerTitles.ARC_GIS_SATELLITE_LAYER,
    LayerTitles.NOAA_ENC_LAYER,
];
// We estimate about 11 kB per tile, which is approximately correct for larger tile file sizes (such as satellite imagery).
// Other layers may be significantly less, such as Open Street Maps or NOAA ENC tiles.
const ESTIMATED_TILE_SIZE = 11_000;

export default function OfflineMaps() {
    const [selectedOnlineLayerName, setSelectedOnlineLayerName] = useState(LayerTitles.NONE);
    const [isUploadingGeoTIFF, setIsUploadingGeoTIFF] = useState(false);
    const [geoTIFFBytesUploaded, setGeoTIFFBytesUploaded] = useState(0);
    const [geoTIFFTotalBytes, setGeoTIFFTotalBytes] = useState(0);

    const getOnlineTileLayerMenuItems = () => {
        return ONLINE_TILE_LAYERS.map((layerTitle) => (
            <MenuItem value={layerTitle} key={layerTitle}>
                {layerTitle}
            </MenuItem>
        ));
    };

    const importOnlineTileLayer = () => {
        const layer = layers.getLayer(selectedOnlineLayerName) as TileLayer<TileImage>;
        const tileCount = offlineLayerManager.getTileCount(view, layer);
        const esimatedSize = tileCount * ESTIMATED_TILE_SIZE;
        // Need alert
        offlineLayerManager.add(view, layer);
    };

    const clickedUploadGeoTiFF = async () => {
        openFileDialog(".tif", false).then((fileList) => {
            if (fileList.length) {
                uploadGeoTIFF(fileList.item(0));
            }
        });
    };

    const uploadGeoTIFF = async (geoTIFF: File) => {
        if (offlineLayerManager.getLayer(geoTIFF.name)) {
            return;
        }
        const reader = geoTIFF.stream().getReader();
        setIsUploadingGeoTIFF(true);
        setGeoTIFFTotalBytes(geoTIFF.size);
        let bytesUploaded = 0;
        let chunkIndex = 0;

        while (true) {
            const result = await reader.read();
            if (result.done) {
                await jaiaAPI.putOfflineGeoTiffChunk(geoTIFF.name, chunkIndex, new Uint8Array());
                break;
            }
            await jaiaAPI.putOfflineGeoTiffChunk(geoTIFF.name, chunkIndex, result.value);
            bytesUploaded += result.value.length;
            setGeoTIFFBytesUploaded(bytesUploaded);
            chunkIndex += 1;
        }
        setTimeout(() => {
            // After the geoTIFF upload, the server extracts a tileset of PNGs from the geoTIFF
            offlineLayerManager.createOfflineLayers();
            setIsUploadingGeoTIFF(false);
        }, 30_000);
    };

    return (
        <div className="offline-maps-container">
            <div className="geotiff-container">
                <div className="geotiff-select-container">
                    <div className="heading">Upload GeoTIFF to Hub</div>
                    <div onClick={() => clickedUploadGeoTiFF()}>
                        <Icon path={mdiArrowRight} />
                    </div>
                </div>
                <GeoTIFFUploadStatus
                    isUploading={isUploadingGeoTIFF}
                    bytesUploaded={geoTIFFBytesUploaded}
                    totalBytes={geoTIFFTotalBytes}
                />
            </div>
            <div className="save-tiles-container">
                <div className="heading">Save Map to Hub</div>
                <div className="layer-selection-container">
                    <div className="select-section">
                        <FormControl style={{ width: "200px" }}>
                            <InputLabel>Layer</InputLabel>
                            <Select
                                value={selectedOnlineLayerName}
                                onChange={(evt: SelectChangeEvent) =>
                                    setSelectedOnlineLayerName(evt.target.value as LayerTitles)
                                }
                                label="Layer"
                            >
                                {getOnlineTileLayerMenuItems()}
                            </Select>
                        </FormControl>
                        <div onClick={() => importOnlineTileLayer()}>
                            <Icon path={mdiArrowRight} />
                        </div>
                    </div>
                    <TileDownloadStatus />
                </div>
            </div>
            <div className="offline-layers-container">
                <div className="heading-container">
                    <div className="heading">Offline Layers</div>
                    <div className="disk-space">
                        Available: {bytesString(offlineLayerManager.getAvailableDiskBytes())}
                    </div>
                </div>
                <ul>
                    <OfflineLayerList />
                </ul>
            </div>
        </div>
    );
}

function TileDownloadStatus() {
    const tile = offlineLayerManager.getTileDescriptors().at(0);
    if (!tile) {
        return null;
    }

    if (!offlineLayerManager.getIsRunning()) {
        return null;
    }

    const remainingTileCount = offlineLayerManager.getTileDescriptors().length;
    const totalTileCount = offlineLayerManager.getCompletedTiles() + remainingTileCount;
    const percent = Math.round((100 * offlineLayerManager.getCompletedTiles()) / totalTileCount);

    return (
        <div className="progress-section">
            <div>
                <p>{`Importing ${tile.layerName}`}</p>
                <p>{`${offlineLayerManager.getCompletedTiles()} / ${totalTileCount} (${percent}%)`}</p>
            </div>
            <button onClick={() => offlineLayerManager.clear()}>Cancel</button>
        </div>
    );
}

function GeoTIFFUploadStatus(props: UploadProps) {
    if (props.isUploading) {
        const uploadPercent = (props.bytesUploaded / props.totalBytes) * 100;
        const text =
            uploadPercent === 100 ? "Extracting..." : `Uploading: ${uploadPercent.toFixed(0)}%`;
        return (
            <div className="geotiff-progress-container">
                <CircularProgress
                    variant="determinate"
                    value={uploadPercent}
                    size={36}
                    style={{ verticalAlign: "middle", marginLeft: "12px", marginRight: "12px" }}
                />
                <div>{text}</div>
            </div>
        );
    }

    return;
}

function OfflineLayerList() {
    return (
        <ul>
            {offlineLayerManager
                .getLayers()
                .getArray()
                .map((layer) => {
                    const title = layer.get("title");
                    return (
                        <li key={title}>
                            <div className="name">{title}</div>
                            <div className="size">{bytesString(layer.get("size"))}</div>
                            <div onClick={() => offlineLayerManager.delete(title)}>
                                <Icon path={mdiDelete} />
                            </div>
                        </li>
                    );
                })}
        </ul>
    );
}

/**
 * Return a human-readable data size value (i.e. "10.2 GB" or "356.2 MB")
 *
 * @param {number} bytes Number of bytes.
 * @returns {string} Human-readable, localized description.
 */
function bytesString(bytes: number) {
    if (isNaN(bytes)) {
        return "";
    }
    if (bytes < 1e9) {
        return (bytes / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " MB";
    } else {
        return (bytes / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " GB";
    }
}
