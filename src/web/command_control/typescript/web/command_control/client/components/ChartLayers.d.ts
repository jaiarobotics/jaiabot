import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
export declare const idbStore: {
    db1: Promise<import("idb").IDBPDatabase<unknown>>;
};
export declare function addToStore1(key: IDBKeyRange | IDBValidKey, value: any): Promise<IDBValidKey>;
export declare function getFromStore1(key: IDBKeyRange | IDBValidKey): Promise<any>;
export declare const gebcoLayer: TileLayer<TileWMS>;
export declare function createChartLayerGroup(): LayerGroup;
