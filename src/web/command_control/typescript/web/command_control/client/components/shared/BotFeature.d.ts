import { BotStatus } from "./JAIAProtobuf";
import { Point } from "ol/geom";
import { Feature, Map } from "ol";
interface Properties {
    map: Map;
    botId: number;
    lonLat: number[];
    heading: number;
    courseOverGround: number;
}
export declare function createBotFeature(properties: Properties): Feature<Point>;
interface BotOtherProperties {
    desiredHeading?: number;
}
export declare function botPopupHTML(bot: BotStatus, properties: BotOtherProperties): string;
export declare function createBotCourseOverGroundFeature(properties: Properties): Feature<Point>;
export declare function createBotDesiredHeadingFeature(properties: Properties): Feature<Point>;
export declare function createBotHeadingFeature(properties: Properties): Feature<Point>;
export {};
