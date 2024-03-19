import React from 'react';
import './CustomAlert.css';
type PresentAlertFunction = (props: CustomAlertProps | null) => void;
export interface CustomAlertButton {
    title: string;
    action?: () => void;
}
export interface CustomAlertProps {
    title?: string;
    text: string;
    buttons?: CustomAlertButton[];
}
export declare class CustomAlert extends React.Component {
    props: CustomAlertProps;
    constructor(props: CustomAlertProps);
    render(): React.ReactNode;
    static setPresenter(presenter: PresentAlertFunction): void;
    static presentAlert(props: CustomAlertProps): void;
    static alert(text: string): void;
    static confirm(text: string, actionTitle: string, action?: () => void, cancelAction?: () => void): void;
    static confirmAsync(text: string, actionTitle: string): Promise<boolean>;
}
export {};
