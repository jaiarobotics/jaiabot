import React from 'react';
import { SelectChangeEvent } from '@mui/material/Select';
import { JaiaAPI } from '../../common/JaiaAPI';
import { Engineering } from './shared/JAIAProtobuf';
import { PortalBotStatus } from './shared/PortalStatus';
import { IJoystickUpdateEvent } from 'react-joystick-component/build/lib/Joystick';
interface Props {
    api: JaiaAPI;
    bot: PortalBotStatus;
    isRCModeActive: boolean;
    remoteControlValues: Engineering;
    rcDiveParameters: {
        [diveParam: string]: string;
    };
    createInterval: () => void;
    deleteInterval: () => void;
    weAreInControl: () => boolean;
    weHaveInterval: () => boolean;
    setRCDiveParameters: (diveParams: {
        [param: string]: string;
    }) => void;
    initRCDivesParams: (botId: number) => void;
}
interface State {
    controlType: string;
    isJoyStickStart: boolean;
    joyStickStatus: {
        [joyStick: string]: boolean;
    };
    throttleDirection: string;
    rudderDirection: string;
    throttleBinNumber: number;
    rudderBinNumber: number;
    botId: number;
}
declare enum JoySticks {
    LEFT = "LEFT",
    RIGHT = "RIGHT",
    SOLE = "SOLE"
}
export default class RCControllerPanel extends React.Component {
    api: JaiaAPI;
    props: Props;
    state: State;
    constructor(props: Props);
    updateThrottleDirectionMove(event: IJoystickUpdateEvent): void;
    calcThrottleBinNum(speed: number, throttleDirection: string, bin: {
        binNumber: number;
        binValue: number;
    }): number;
    updateThrottleDirectionStop(): void;
    updateRudderDirectionMove(event: IJoystickUpdateEvent): void;
    calcRudderBinNum(position: number, bin: {
        binNumber: number;
        binValue: number;
    }, deadzonePercent: number): void;
    updateRudderDirectionStop(): void;
    moveSoloController(event: IJoystickUpdateEvent): void;
    handleGamepadAxisChange(axisName: string, value: number): void;
    controlChange(event: SelectChangeEvent): void;
    setJoyStickStatus(joySticksOn: JoySticks[]): void;
    handleTaskParamInputChange(evt: React.ChangeEvent<HTMLInputElement>): void;
    handleDiveButtonClick(): void;
    isDiveButtonDisabled(): boolean;
    clearRemoteControlValues(): void;
    render(): React.JSX.Element;
}
export {};
