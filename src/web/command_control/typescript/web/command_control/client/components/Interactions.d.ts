import * as Interaction from "ol/interaction";
import * as Events from "ol/events";
import CommandControl from "./CommandControl";
import { Map } from "ol";
import PointerInteraction from "ol/interaction/Pointer";
export declare class Interactions {
    measureInteraction: Interaction.Draw;
    measureListener: Events.EventsKey;
    dragAndDropInteraction: Interaction.DragAndDrop;
    pointerInteraction: PointerInteraction;
    selectInteraction: Interaction.Select;
    translateInteraction: Interaction.Translate;
    constructor(commandControl: CommandControl, map: Map);
}
