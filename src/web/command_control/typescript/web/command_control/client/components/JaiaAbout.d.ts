import React from 'react';
import '../style/components/JaiaAbout.css';
import { Metadata } from './shared/PortalStatus';
interface Props {
    metadata: Metadata;
}
export default class JaiaAbot extends React.Component {
    props: Props;
    constructor(props: Props);
    componentDidMount(): void;
    closeAboutCard(): void;
    render(): React.JSX.Element;
}
export {};
