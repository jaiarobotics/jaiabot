import { ConstantHeadingParameters, SRPParameters, DiveParameters, DriftParameters, Speeds } from "./shared/JAIAProtobuf";
import { Coordinate } from 'ol/coordinate';
export declare function Load<T>(key: string, defaultValue: T): T;
export declare function LoadMissions<T>(key: string): T;
export declare function Save(value: any): void;
export declare function SaveMissions(key: string, value: any): void;
export interface MapSettings {
    visibleLayers: string[];
    center: Coordinate;
    zoomLevel: number;
    rotation: number;
}
export declare let GlobalSettings: {
    diveParameters: DiveParameters;
    driftParameters: DriftParameters;
    constantHeadingParameters: ConstantHeadingParameters;
    srpParameters: SRPParameters;
    missionPlanSpeeds: Speeds;
    mapSettings: MapSettings;
};
