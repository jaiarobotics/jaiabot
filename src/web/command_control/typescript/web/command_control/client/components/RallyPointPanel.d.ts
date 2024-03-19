import React from 'react';
import OlFeature from 'ol/Feature';
import { Point } from 'ol/geom';
import { PanelType } from './CommandControl';
import '../style/components/RallyPointPanel.css';
interface Props {
    selectedRallyFeature: OlFeature<Point>;
    goToRallyPoint: (feature: OlFeature<Point>) => void;
    deleteRallyPoint: (feature: OlFeature<Point>) => void;
    setVisiblePanel: (panelType: PanelType) => void;
}
export declare function RallyPointPanel(props: Props): React.JSX.Element;
export {};
