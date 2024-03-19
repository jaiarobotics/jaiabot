import React from 'react';
import { JaiaAPI } from '../../common/JaiaAPI';
interface Props {
    api: JaiaAPI;
    control: (onSuccess: () => void) => void;
}
export default class QueryBotStatusPanel extends React.Component {
    props: Props;
    constructor(props: Props);
    render(): React.JSX.Element;
    submitQueryBotStatus(): void;
}
export {};
