import React from 'react'
import './CustomAlert.css'

type PresentAlertFunction = (props: CustomAlertProps | null) => void
let presentAlert: PresentAlertFunction

export interface CustomAlertButton {
    title: string
    action?: () => void
}

export interface CustomAlertProps {
    title?: string
    text: string
    buttons?: CustomAlertButton[]
}

// Dropdown menu showing all of the available logs to choose from
export class CustomAlert extends React.Component {
    props: CustomAlertProps

    constructor(props: CustomAlertProps) {
        super(props)

        this.props = props
    }

    render(): React.ReactNode {
        var buttons: React.JSX.Element[]

        if (this.props.buttons == null) {
            buttons = [
                <div className='button' onClick={() => {presentAlert(null)}}>Close</div>
            ]
        }
        else {
            buttons = this.props.buttons.map((buttonInput: CustomAlertButton) => {
                return <div className='button' onClick={() => {
                    presentAlert(null)
                    buttonInput.action?.()
                }}>{buttonInput.title}</div>
            })
        }

        // Deal with newlines in text
        const textDivs = this.props.text.split('\n').map((line: string) => {
            return <div className='text'>{line}</div>
        })

        return <div className='fullscreen'>
            <div className="custom-alert">
                <div className='title'>{this.props.title ?? 'Alert'}</div>
                {textDivs}
                <div className='button-container'>
                    {buttons}
                </div>
            </div>
        </div>
    }

    static setPresenter(presenter: PresentAlertFunction) {
        presentAlert = presenter
    }

    static presentAlert(props: CustomAlertProps) {
        presentAlert(props)
    }

    static alert(text: string) {
        presentAlert({text})
    }

    static confirm(text: string, actionTitle: string, action?: ()=>void) {
        presentAlert({
            title: 'Confirm',
            text: text,
            buttons: [
                {
                    title: 'Cancel'
                },
                {
                    title: actionTitle,
                    action: action
                }
            ]
        })
    }

}
