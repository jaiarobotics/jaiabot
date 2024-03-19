import React from 'react';
import { MissionTask, GeographicCoordinate } from './shared/JAIAProtobuf';
import Map from 'ol/Map';
interface Props {
    map?: Map;
    title?: string;
    task?: MissionTask;
    location?: GeographicCoordinate;
    isEditMode?: boolean;
    scrollTaskSettingsIntoView?: () => void;
    onChange?: (task?: MissionTask) => void;
    onDoneClick?: (task?: MissionTask) => void;
}
export declare function TaskSettingsPanel(props: Props): React.JSX.Element;
export {};
