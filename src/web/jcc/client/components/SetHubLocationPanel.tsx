/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */
import React from 'react'
import Button from '@mui/material/Button';
import {JaiaAPI} from '../../common/JaiaAPI'
import { PortalHubStatus } from './shared/PortalStatus';

interface Props {
    hubs: {[key: number]: PortalHubStatus}
    api: JaiaAPI
}

export default class SetHubLocationPanel extends React.Component {
    props: Props

    constructor(props: Props) {
        super(props)
    }

    render() {

        const hubLocation = this.props.hubs[0].location

        return (
            <div className="panel">
                <label>Set Hub Location</label>
                <Button className="button-jcc engineering-panel-btn" type="button" id="set-hub-location-map-select">Select on Map</Button>
                <table>
                    <tbody>
                        <tr key="latitude">
                            <td>Latitude</td>
                            <td>
                                <input 
                                    id="latitude" 
                                    name="latitude" 
                                    defaultValue={hubLocation.lat.toFixed(6)}
                                />
                            </td>
                        </tr>
                        <tr key="longitude">
                            <td>Longitude</td>
                            <td>
                                <input
                                    id="longitude" 
                                    name="longitude" 
                                    defaultValue={hubLocation.lon.toFixed(6)}
                                />
                            </td>
                        </tr>
                        <tr key="submit">

                        </tr>
                    </tbody>
                </table>
                <Button className="button-jcc engineering-panel-btn" type="button" id="set-hub-location-submit">Submit Values</Button>
            </div>
        )

    }
}
