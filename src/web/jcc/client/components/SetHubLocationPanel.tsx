/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react'
import Button from '@mui/material/Button';
import {JaiaAPI} from '../../common/JaiaAPI'
import { PortalHubStatus } from './shared/PortalStatus';
import { CommandForHub, GeographicCoordinate, HubCommandType } from './shared/JAIAProtobuf';
import { getElementById, getGeographicCoordinate } from './shared/Utilities';
import { Map } from 'ol';
import PointerInteraction from 'ol/interaction/Pointer';
import { Select, MenuItem } from '@mui/material';

interface Props {
    hubs: {[key: number]: PortalHubStatus}
    api: JaiaAPI
    map: Map
}


export default function SetHubLocationPanel(props: Props) {
    const [ hub_id, set_hub_id ] = useState(Number(Object.keys(props.hubs)[0]) ?? 1)
    const [ selectingOnMap, setSelectingOnMap ] = useState(false)
    const selectOnMapInteractionRef = useRef(null)

    const hubLocation = props.hubs[hub_id].location

    /**
     * A Select element for choosing the hub_id.
     *
     * @returns {*} The Select element.
     */
    function hubIdSelectionElement() {
        const menuItems = Object.values(props.hubs).map((hub) => {
            return <MenuItem value={hub.hub_id}>{`Hub ${hub.hub_id}`}</MenuItem>
        })

        const labelRow = <div className='mission-settings-input-label'>
                Hub ID
            </div>

        const hubIdSelectionRow = 
            <div className='mission-settings-input-row'>
                <Select id="bot-id-select" defaultValue={hub_id} onChange={(evt) => {
                        set_hub_id(Number(evt.target.value))
                    }}>
                    { menuItems }
                </Select>
            </div>

        return [ labelRow, hubIdSelectionRow ]
    }


    
    /**
     * Gets the hub location from the text inputs.
     *
     * @returns {GeographicCoordinate}
     */
    function getInputHubLocation(): GeographicCoordinate {
        const lat = Number(getElementById<HTMLInputElement>('set-hub-location-latitude').value)
        const lon = Number(getElementById<HTMLInputElement>('set-hub-location-longitude').value)
        if (lat == null || lon == null) {
            return null
        }

        return {
            lat: lat,
            lon: lon
        }
    }


    /**
     * Calls the API to submit a location change for a certain hub.
     *
     */
    function submitHubLocation() {
        const hubLocation = getInputHubLocation()

        if (hubLocation == null) {
            console.warn('hub location is null')
            return
        }

        const hubCommand: CommandForHub = {
            hub_id: hub_id,
            type: HubCommandType.SET_HUB_LOCATION,
            set_hub_location: hubLocation
        }

        props.api.postCommandForHub(hubCommand)
    }

    
    /**
     * Initiate a PointerInteraction to select a new hub location with a click or tap.
     */
    const toggleSelectOnMapInteraction = () => {
        if (selectOnMapInteractionRef.current != null) {
            destroySelectOnMapInteraction()
            return
        }

        selectOnMapInteractionRef.current = new PointerInteraction({
            handleEvent: (evt) => {
                if (evt.type == "click") {
                    const clickedLocation = getGeographicCoordinate(evt.coordinate, evt.map)
                    getElementById<HTMLInputElement>('set-hub-location-latitude').value = clickedLocation.lat.toFixed(6)
                    getElementById<HTMLInputElement>('set-hub-location-longitude').value = clickedLocation.lon.toFixed(6)
                    submitHubLocation()
                    destroySelectOnMapInteraction()
                    return false
                }
                else {
                    return true
                }
            }
        })
        setSelectingOnMap(true)
        props.map.addInteraction(selectOnMapInteractionRef.current)
        props.map.getTargetElement().style.cursor = 'crosshair'
    }
    

    /**
     * Destroy the hub location selection interaction.
     */
    const destroySelectOnMapInteraction = () => {
        if (selectOnMapInteractionRef.current != null) {
            props.map.removeInteraction(selectOnMapInteractionRef.current)
            selectOnMapInteractionRef.current = null
            props.map.getTargetElement().style.cursor = 'default'
            setSelectingOnMap(false)
        }
    }


    // Destroy the map select interaction on unmount, if present.
    useEffect(() => {
        return destroySelectOnMapInteraction
    }, [])


    return (
        <div className="panel" key="set-hub-location">
            <div className='panel-heading' style={{color: "black"}}>Set Hub Location</div>
            <div className='mission-settings-panel-container'>

                { /* this.hubIdSelectionElement() */ }

                <div className='mission-settings-input-label'>Latitude</div>
                <div className='mission-settings-input-row'>
                    <input className="mission-settings-num-input"
                        id="set-hub-location-latitude" 
                        name="latitude" 
                        defaultValue={hubLocation.lat.toFixed(6)}
                    />
                </div>

                <div className='mission-settings-input-label'>Longitude</div>
                <div className='mission-settings-input-row'>
                    <input className="mission-settings-num-input"
                        id="set-hub-location-longitude" 
                        name="longitude" 
                        defaultValue={hubLocation.lon.toFixed(6)}
                    />
                </div>
            </div>
            <Button
                className="button-jcc engineering-panel-btn"
                type="button"
                id="set-hub-location-submit"
                onClick={submitHubLocation}>
                Submit Values
            </Button>
            <Button
                className={"button-jcc engineering-panel-btn" + (selectingOnMap ? " selected" : "")}
                type="button"
                id="set-hub-location-map-select"
                onClick={toggleSelectOnMapInteraction}
                >
                Select on Map
            </Button>
        </div>
    )
}
