import React from 'react'
import Icon from '@mdi/react';
import { mdiClose } from '@mdi/js';
import '../style/jaia-about.less';

export default class JaiaAbot extends React.Component {
    render() {
        return (
            <div className="jaiaAboutContainer">
                <Icon path={mdiClose} size={1} className="jaiaAboutCloseBtn"/>
                <img src="/favicon.png" className="jaiaAboutLogo"></img>
                <div className="jaiaAboutLabel">Website</div>
                <a href="https://www.jaia.tech" className="jaiaAboutInput">www.jaia.tech</a>
                <div className="jaiaAboutLabel">Phone</div>
                <div className="jaiaAboutInput">+1 (401) 214 9232</div>
                <div className="jaiaAboutLabel">Address</div>
                <div className="jaiaAboutInput">22 Burnside St Bristol RI 02809</div>
                <div className="jaiaAboutLabel">JCC Version</div>
                <div className="jaiaAboutInput">1.5.2</div>
                <div className="jaiaAboutLabel">Documentation</div>
                <a href="http://52.36.157.57/index.html" className="jaiaAboutInput">JaiaDocs</a>
            </div>
        )
    }
}