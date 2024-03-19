import React from 'react';
import { Speeds } from './shared/JAIAProtobuf';
interface Props {
}
interface State {
    go_over_max_value: boolean;
    safe_speed_watch: number;
    speeds: Speeds;
    speed_max: number;
}
export default class MissionSpeedSettingsPanel extends React.Component {
    speeds: Speeds;
    state: State;
    constructor(props: Props);
    render(): React.JSX.Element;
}
export {};
