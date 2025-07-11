// Kaitlyn made most recent changes to this code
//Finished changes to controller must have leaders test just in case
import React from "react";
import "./CustomAlert.css";

type PresentAlertFunction = (props: CustomAlertProps | null) => void;
let presentAlert: PresentAlertFunction;

let currentConfirmYes: (() => void) | null = null;
let currentConfirmNo: (() => void) | null = null;

export function handleGamepadAlertConfirm(buttonName: string) {
    if (buttonName === "RB" && currentConfirmYes) {
        currentConfirmYes();
    } else if (buttonName === "LB" && currentConfirmNo) {
        currentConfirmNo();
    }
}

export interface CustomAlertButton {
    title: string;
    action?: () => void;
}

export interface CustomAlertProps {
    title?: string;
    text: string;
    buttons?: CustomAlertButton[];
}

export class CustomAlert extends React.Component {
    props: CustomAlertProps;

    constructor(props: CustomAlertProps) {
        super(props);
        this.props = props;
    }

    render(): React.ReactNode {
        var buttons: React.JSX.Element[];

        if (this.props.buttons == null) {
            buttons = [
                <div
                    className="button"
                    onClick={() => {
                        presentAlert(null);
                    }}
                >
                    Close
                </div>,
            ];
        } else {
            buttons = this.props.buttons.map((buttonInput: CustomAlertButton) => {
                return (
                    <div
                        className="button"
                        onClick={() => {
                            presentAlert(null);
                            buttonInput.action?.();
                        }}
                    >
                        {buttonInput.title}
                    </div>
                );
            });
        }

        // Deal with newlines in text
        const textDivs = this.props.text.split("\n").map((line: string) => {
            return <div className="text">{line}</div>;
        });

        return (
            <div className="fullscreen">
                <div
                    className="custom-alert"
                    style={{ border: this.props.title === "Warning" ? "3px solid red" : "none" }}
                >
                    <div className="title">{this.props.title ?? "Alert"}</div>
                    {textDivs}
                    <div className="button-container">{buttons}</div>
                </div>
            </div>
        );
    }

    static setPresenter(presenter: PresentAlertFunction) {
        presentAlert = presenter;
    }

    static presentAlert(props: CustomAlertProps) {
        presentAlert(props);
    }

    static alert(text: string) {
        presentAlert({ text });
    }

    static confirm(
        text: string,
        actionTitle: string,
        action?: () => void,
        cancelAction?: () => void,
    ) {
        // Setup controller-based confirmation
        currentConfirmYes = () => {
            presentAlert(null);
            action?.();
            currentConfirmYes = null;
            currentConfirmNo = null;
        };

        currentConfirmNo = () => {
            presentAlert(null);
            cancelAction?.();
            currentConfirmYes = null;
            currentConfirmNo = null;
        };

        presentAlert({
            title: "Confirm",
            text: text,
            buttons: [
                {
                    title: "Cancel",
                    action: currentConfirmNo,
                },
                {
                    title: actionTitle,
                    action: currentConfirmYes,
                },
            ],
        });
    }

    static confirmAsync(text: string, actionTitle: string, title?: string): Promise<boolean> {
        return new Promise((resolve) => {
            const handleGamepadConfirm = (e: any) => {
                if (e.detail === "RB") {
                    cleanup();
                    resolve(true);
                } else if (e.detail === "LB") {
                    cleanup();
                    resolve(false);
                }
            };

            const cleanup = () => {
                presentAlert(null);
                window.removeEventListener("gamepad-button", handleGamepadConfirm);
            };

            window.addEventListener("gamepad-button", handleGamepadConfirm);

            presentAlert({
                title: title ? title : "Confirm",
                text: text,
                buttons: [
                    {
                        title: "Cancel",
                        action: () => {
                            cleanup();
                            resolve(false);
                        },
                    },
                    {
                        title: actionTitle,
                        action: () => {
                            cleanup();
                            resolve(true);
                        },
                    },
                ],
            });
        });
    }
}
