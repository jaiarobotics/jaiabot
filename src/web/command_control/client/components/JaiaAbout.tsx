import React from 'react'
import Icon from '@mdi/react'
import { mdiClose } from '@mdi/js'
import '../style/components/JaiaAbout.css'
import { Metadata } from './shared/PortalStatus'

interface Props {
	metadata: Metadata
}

export default class JaiaAbot extends React.Component {
    props: Props

    constructor(props: Props) {
        super(props)
    }

    componentDidMount() {
        this.closeAboutCard()
    }

    closeAboutCard() {
        const aboutCard = document.getElementById('jaiaAboutContainer') as HTMLElement
        aboutCard.style.display = 'none'
    }

    render() {
        let jcc_version = ""

        if (this.props?.metadata?.jaiabot_version?.major
            && this.props?.metadata?.jaiabot_version?.minor
            && this.props?.metadata?.jaiabot_version?.patch) {
            jcc_version = this.props.metadata.jaiabot_version.major + "." 
                            + this.props.metadata.jaiabot_version.minor + "."
                            + this.props.metadata.jaiabot_version.patch
        }
        
        return (
            <div id='jaiaAboutContainer'>
                <div className='jaiaAboutCloseBtnContainer' onClick={() => this.closeAboutCard()}>
                    <Icon path={mdiClose} size={1} className='jaiaAboutCloseBtn'/>
                </div>
                <img src='/favicon.png' className='jaiaAboutLogo'></img>
                <div className='jaiaAboutContactContainer'>
                    <div className='jaiaAboutLabel'>Website:</div>
                    <a href='https://www.jaia.tech' className='jaiaAboutInput jaiaAboutLink' target='_blank' rel='noopener noreferrer'>www.jaia.tech</a>
                </div>
                <div className='jaiaAboutContactContainer'>
                    <div className='jaiaAboutLabel'>Phone:</div>
                    <div className='jaiaAboutInput'>+1 (401) 214-9232</div>
                </div>
                <div className='jaiaAboutContactContainer'>
                    <div className='jaiaAboutLabel'>Address:</div>
                    <div className='jaiaAboutInput'>22 Burnside St Bristol RI 02809</div>
                </div>
                <div className='jaiaAboutContactContainer'>
                    <div className='jaiaAboutLabel'>JCC Version:</div>
                    <div className='jaiaAboutInput'>{jcc_version}</div>
                </div>
                <div className='jaiaAboutContactContainer lastJaiaInfoContainer'>
                    <div className='jaiaAboutLabel'>Documentation:</div>
                    <a href='http://52.36.157.57/index.html' target='_blank' rel='noopener noreferrer' className='jaiaAboutInput jaiaAboutLink'>JaiaDocs</a>
                </div>
            </div>
        )
    }
}