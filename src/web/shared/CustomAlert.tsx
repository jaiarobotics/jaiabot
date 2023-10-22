import React from 'react'
import './CustomAlert.css'

type PresentAlertFunction = (props: CustomAlertProps | null) => void
let presentAlert: PresentAlertFunction

export interface CustomAlertProps {
    title?: string
    text: string
}

// Dropdown menu showing all of the available logs to choose from
export class CustomAlert extends React.Component {
    props: CustomAlertProps

    constructor(props: CustomAlertProps) {
        super(props)

        this.props = props
    }

    render(): React.ReactNode {
        return <div className='fullscreen'>
            <div className="custom-alert">
                <div className='title'>{this.props.title ?? 'Alert'}</div>
                <div className='text'>{this.props.text}</div>
                <div className='button-container'>
                    <div className='close-button' onClick={() => {presentAlert(null)}}>Close</div>
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

}
