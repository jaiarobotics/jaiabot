import { Draw as OlDrawInteraction } from "ol/interaction";
import { Vector as OlVectorSource } from "ol/source";
import { EventsKey } from "ol/events";
import CommandControl from "./CommandControl";
export declare class SurveyLines {
    commandControl: CommandControl;
    vectorSource: OlVectorSource;
    listener: EventsKey;
    drawInteraction: OlDrawInteraction;
    constructor(commandControl: CommandControl);
    validateSurveySpacingInputs(): void;
}
