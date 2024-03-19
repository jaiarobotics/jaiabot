import { Command, Engineering, CommandForHub } from '../../shared/JAIAProtobuf';
import { Geometry } from 'ol/geom';
export declare class JaiaAPI {
    clientId: string;
    url: string;
    debug: boolean;
    headers: {
        [key: string]: string;
    };
    constructor(clientId: string, url?: string, debug?: boolean);
    hit(method: string, endpoint: string, requestBody?: any): Promise<any>;
    post(endpoint: string, body?: any): Promise<any>;
    get(endpoint: string): Promise<any>;
    getMetadata(): Promise<any>;
    getStatus(): Promise<any>;
    getTaskPackets(startDate?: string, endDate?: string): Promise<any>;
    getTaskPacketsCount(): Promise<any>;
    getDepthContours(startDate?: string, endDate?: string): Promise<any>;
    getDriftMap(startDate?: string, endDate?: string): Promise<void | import("ol/Feature").default<Geometry>[]>;
    allStop(): Promise<any>;
    allActivate(): Promise<any>;
    nextTaskAll(): Promise<any>;
    allRecover(): Promise<any>;
    postCommand(command: Command): Promise<any>;
    postCommandForHub(command: CommandForHub): Promise<any>;
    postEngineeringPanel(engineeringPanelCommand: Engineering): Promise<any>;
    takeControl(): Promise<any>;
    postEngineering(engineeringCommand: Engineering): Promise<any>;
    postMissionFilesCreate(descriptor: any): Promise<any>;
}
export declare const jaiaAPI: JaiaAPI;
