import React from 'react'

import { Metadata } from '../../../../shared/PortalStatus'

import Icon from '@mdi/react'
import { mdiClose } from '@mdi/js'
import './JaiaAbout.css'

interface Props {
	metadata: Metadata
}

export default class JaiaAbout extends React.Component {
    props: Props

    constructor(props: Props) {
        super(props)
    }

    componentDidMount() {
        this.closeAboutCard()
    }

    closeAboutCard() {
        const aboutCard = document.getElementById('jaia-about-container') as HTMLElement
        aboutCard.style.display = 'none'
    }

    render() {
        let jcc_version = ''

        if (
            this.props?.metadata?.jaiabot_version?.major && 
            this.props?.metadata?.jaiabot_version?.minor && 
            this.props?.metadata?.jaiabot_version?.patch
        ) {
            jcc_version = this.props.metadata.jaiabot_version.major + '.'
                        + this.props.metadata.jaiabot_version.minor + '.'
                        + this.props.metadata.jaiabot_version.patch
        }
        
        return (
            <div id='jaia-about-container'>
                <div className='jaia-about-close-btn-container' onClick={() => this.closeAboutCard()}>
                    <Icon path={mdiClose} size={1} className='jaia-about-close-btn'/>
                </div>
                <img src='/favicon.png' className='jaia-about-logo'></img>
                <div className='jaia-about-contact-container'>
                    <div className='jaia-about-label'>Website:</div>
                    <a href='https://www.jaia.tech' className='jaia-about-input jaia-about-link' target='_blank' rel='noopener noreferrer'>www.jaia.tech</a>
                </div>
                <div className='jaia-about-contact-container'>
                    <div className='jaia-about-label'>Phone:</div>
                    <div className='jaia-about-input'>+1 (401) 214-9232</div>
                </div>
                <div className='jaia-about-contact-container'>
                    <div className='jaia-about-label'>Address:</div>
                    <div className='jaia-about-input'>22 Burnside St Bristol RI 02809</div>
                </div>
                <div className='jaia-about-contact-container'>
                    <div className='jaia-about-label'>JCC Version:</div>
                    <div className='jaia-about-input'>{jcc_version}</div>
                </div>
                <div className='jaia-about-contact-container last-jaia-info-container'>
                    <div className='jaia-about-label'>Documentation:</div>
                    <a href='http://52.36.157.57/index.html' target='_blank' rel='noopener noreferrer' className='jaia-about-input jaia-about-link'>JaiaDocs</a>
                </div>
            </div>
        )
    }
}