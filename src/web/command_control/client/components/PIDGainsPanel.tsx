/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import $ from 'jquery'
import React from 'react'
import { error, success, warning, info, debug } from '../libs/notifications'
import Button from '@mui/material/Button'
import {
    BotStatus,
    Engineering,
    BotStatusRate,
    PIDControl,
    RFDisableOptions
} from './shared/JAIAProtobuf'
import { JaiaAPI } from '../../common/JaiaAPI'

let pid_types = ['speed', 'heading', 'roll', 'pitch', 'depth']
let pid_gains = ['Kp', 'Ki', 'Kd']

interface APIBotStatus extends BotStatus {
    engineering: Engineering
}

interface Props {
    api: JaiaAPI
    bots: { [key: number]: APIBotStatus }
    control: () => boolean
}

interface State {
    bots: { [key: number]: APIBotStatus }
}

export class PIDGainsPanel extends React.Component {
    botId: number | null
    props: Props
    state: State

    constructor(props: Props) {
        super(props)

        this.state = {
            bots: props.bots
        }
    }

    static getDerivedStateFromProps(props: Props) {
        return {
            bots: props.bots
        }
    }

    render() {
        let botStatusRate = Object.keys(BotStatusRate)

        let bots = this.state.bots

        // No bots in list
        if (bots == null || Object.keys(bots).length == 0) {
            return <div></div>
        }

        // If we haven't selected a bot yet, and there are bots available, then select the lowest indexed bot
        if (this.botId == null) {
            this.botId = Number(Object.keys(bots)[0])
        }

        let self = this

        let botSelector = (
            <div>
                <label style={{ fontSize: '32px', marginRight: '25px', color: '#0bc9cd' }}>
                    Bot
                </label>
                <select
                    style={{ width: '50px', marginBottom: '10px', color: '#0bc9cd' }}
                    name='bot'
                    id='pid_gains_bot_selector'
                    defaultValue={self.botId}
                    onChange={self.didSelectBot.bind(self)}
                >
                    {bots
                        ? Object.keys(bots).map((botId) => (
                              <option key={botId} value={botId}>
                                  {botId}
                              </option>
                          ))
                        : ''}
                </select>
            </div>
        )

        let engineering = bots[self.botId]?.engineering

        //console.log(engineering);

        let bot_status_rate = engineering?.bot_status_rate ?? 'BotStatusRate_1_Hz'
        let show_rate = 'N/A'

        if (engineering) {
            if (bot_status_rate != null || bot_status_rate != undefined) {
                let split_rate = bot_status_rate.split('_')
                show_rate = split_rate[1] + '_' + split_rate[2]
            }
        }

        function pidGainsTable(engineering: Engineering) {
            if (engineering) {
                return (
                    <table>
                        <thead>
                            <tr key='header'>
                                <th key=''></th>
                                <th key='Kp'>Kp</th>
                                <th key='Ki'>Ki</th>
                                <th key='Kd'>Kd</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pid_types.map(function (pid_type) {
                                return (
                                    <tr key={pid_type}>
                                        <td key='pid_type_name'>{pid_type}</td>
                                        {pid_gains.map(function (pid_gain) {
                                            let pid_type_gain = pid_type + '_' + pid_gain
                                            let botId_pid_type_gain =
                                                self.botId + '_' + pid_type_gain
                                            let pid_control = engineering.pid_control as any

                                            return (
                                                <td key={botId_pid_type_gain}>
                                                    <input
                                                        style={{ maxWidth: '80px' }}
                                                        type='text'
                                                        id={pid_type_gain}
                                                        name={pid_type_gain}
                                                        defaultValue={
                                                            pid_control?.[pid_type]?.[pid_gain] ??
                                                            '-'
                                                        }
                                                    />
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )
            } else {
                return <div></div>
            }
        }

        function botRequirementsTable(engineering: Engineering) {
            if (engineering) {
                return (
                    <React.Fragment>
                        <h3>Requirements</h3>
                        <table id='engineering_requirements_table'>
                            <tbody>
                                <tr>
                                    <td key='current_status_rate_label'>Current Status Rate</td>
                                    <td key='current_status_rate'>{show_rate}</td>
                                </tr>
                                <tr>
                                    <td key='rf_disable_timeout_mins_label'>
                                        Current RF Disable Time Mins
                                    </td>
                                    <td key='current_rf_disable_timeout_mins'>
                                        {engineering?.rf_disable_options?.rf_disable_timeout_mins ??
                                            '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_transit_hdop_req_label'>
                                        Current Transit HDOP
                                    </td>
                                    <td key='current_transit_hdop_req'>
                                        {engineering?.gps_requirements?.transit_hdop_req ?? '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_transit_pdop_req_label'>
                                        Current Transit PDOP
                                    </td>
                                    <td key='current_transit_pdop_req'>
                                        {engineering?.gps_requirements?.transit_pdop_req ?? '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_after_dive_hdop_req_label'>
                                        Current After Dive HDOP
                                    </td>
                                    <td key='current_after_dive_hdop_req'>
                                        {engineering?.gps_requirements?.after_dive_hdop_req ?? '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_after_dive_pdop_req_label'>
                                        Current After Dive PDOP
                                    </td>
                                    <td key='current_after_dive_pdop_req'>
                                        {engineering?.gps_requirements?.after_dive_pdop_req ?? '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_transit_gps_checks_label'>
                                        Current Transit GPS Checks
                                    </td>
                                    <td key='current_transit_gps_checks_req'>
                                        {engineering?.gps_requirements?.transit_gps_fix_checks ??
                                            '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_transit_gps_degraded_checks_label'>
                                        Current Degraded GPS Checks
                                    </td>
                                    <td key='current_transit_gps_degraded_checks_req'>
                                        {engineering?.gps_requirements
                                            ?.transit_gps_degraded_fix_checks ?? '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_after_dive_gps_checks_label'>
                                        Current After Dive GPS Checks
                                    </td>
                                    <td key='current_after_dive_gps_checks_req'>
                                        {engineering?.gps_requirements?.after_dive_gps_fix_checks ??
                                            '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='status_rate_label'>Update Status Rate</td>
                                    <td key='status_rate_input'>
                                        <select id='status_rate_input'>
                                            <option value='-1' key='-1'>
                                                ...
                                            </option>

                                            {botStatusRate.map((rate, index) => {
                                                let split_rate = rate.split('_')
                                                let show_rate = split_rate[1] + '_' + split_rate[2]
                                                return (
                                                    <option value={index} key={index}>
                                                        {show_rate}
                                                    </option>
                                                )
                                            })}
                                        </select>
                                    </td>
                                </tr>
                                <tr>
                                    <td key='rf_disable_timeout_mins_label'>
                                        Update RF Disable Time Mins
                                    </td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='rf_disable_timeout_mins_input'
                                            name='rf_disable_timeout_mins_input'
                                            defaultValue={
                                                engineering?.rf_disable_options
                                                    ?.rf_disable_timeout_mins ?? '-'
                                            }
                                            min='1'
                                            max='255'
                                            step='1'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='transit_hdop_req_label'>Update Transit HDOP</td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='transit_hdop_req_input'
                                            name='transit_hdop_req_input'
                                            defaultValue={
                                                engineering?.gps_requirements?.transit_hdop_req ??
                                                '-'
                                            }
                                            min='1'
                                            max='100'
                                            step='any'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='transit_pdop_req_label'>Update Transit PDOP</td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='transit_pdop_req_input'
                                            name='transit_pdop_req_input'
                                            defaultValue={
                                                engineering?.gps_requirements?.transit_pdop_req ??
                                                '-'
                                            }
                                            min='1'
                                            max='100'
                                            step='any'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='after_dive_hdop_req_label'>Update After Dive HDOP</td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='after_dive_hdop_req_input'
                                            name='after_dive_hdop_req_input'
                                            defaultValue={
                                                engineering?.gps_requirements
                                                    ?.after_dive_hdop_req ?? '-'
                                            }
                                            min='1'
                                            max='100'
                                            step='any'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='after_dive_pdop_req_label'>Update After Dive PDOP</td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='after_dive_pdop_req_input'
                                            name='after_dive_pdop_req_input'
                                            defaultValue={
                                                engineering?.gps_requirements
                                                    ?.after_dive_pdop_req ?? '-'
                                            }
                                            min='1'
                                            max='100'
                                            step='any'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='transit_gps_checks_label'>
                                        Update Transit GPS Checks
                                    </td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='transit_gps_checks_input'
                                            name='transit_gps_checks_input'
                                            defaultValue={
                                                engineering?.gps_requirements
                                                    ?.transit_gps_fix_checks ?? '-'
                                            }
                                            min='1'
                                            max='100'
                                            step='1'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='transit_gps_degraded_checks_label'>
                                        Update Degraded GPS Checks
                                    </td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='transit_gps_degraded_checks_input'
                                            name='transit_gps_degraded_checks_input'
                                            defaultValue={
                                                engineering?.gps_requirements
                                                    ?.transit_gps_degraded_fix_checks ?? '-'
                                            }
                                            min='1'
                                            max='100'
                                            step='1'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='after_dive_gps_checks_label'>
                                        Update After Dive GPS Checks
                                    </td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='after_dive_gps_checks_input'
                                            name='after_dive_gps_checks_input'
                                            defaultValue={
                                                engineering?.gps_requirements
                                                    ?.after_dive_gps_fix_checks ?? '-'
                                            }
                                            min='1'
                                            max='100'
                                            step='1'
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </React.Fragment>
                )
            } else {
                return <div></div>
            }
        }

        function botSafetyTable(engineering: Engineering) {
            if (engineering) {
                return (
                    <React.Fragment>
                        <h3>SRP</h3>
                        <table id='engineering_safety_table'>
                            <tbody>
                                <tr>
                                    <td key='safety_depth_label'>Current Depth Safety (m)</td>
                                    <td key='safety_depth'>
                                        {engineering?.bottom_depth_safety_params?.safety_depth ??
                                            '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_bottom_depth_safety_heading_label'>
                                        Current Depth Safety Heading (deg)
                                    </td>
                                    <td key='current_bottom_depth_safety_heading'>
                                        {engineering?.bottom_depth_safety_params
                                            ?.constant_heading ?? '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_bottom_depth_safety_time_label'>
                                        Current Depth Safety Time (s)
                                    </td>
                                    <td key='current_bottom_depth_safety_time'>
                                        {engineering?.bottom_depth_safety_params
                                            ?.constant_heading_time ?? '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='current_bottom_depth_safety_speed_label'>
                                        Current Depth Safety Speed (m/s)
                                    </td>
                                    <td key='current_bottom_depth_safety_speed'>
                                        {engineering?.bottom_depth_safety_params
                                            ?.constant_heading_speed ?? '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td key='safety_depth_label'>Update Depth Safety (m)</td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='safety_depth_input'
                                            name='safety_depth_input'
                                            defaultValue={
                                                engineering?.bottom_depth_safety_params
                                                    ?.safety_depth ?? '-'
                                            }
                                            min='0'
                                            max='60'
                                            step='any'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='bottom_depth_safety_heading_label'>
                                        Update Depth Safety Heading (deg)
                                    </td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='bottom_depth_safety_heading_input'
                                            name='bottom_depth_safety_heading_input'
                                            defaultValue={
                                                engineering?.bottom_depth_safety_params
                                                    ?.constant_heading ?? '-'
                                            }
                                            min='0'
                                            max='360'
                                            step='1'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='bottom_depth_safety_time_label'>
                                        Update Depth Safety Time (s)
                                    </td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='bottom_depth_safety_time_input'
                                            name='bottom_depth_safety_time_input'
                                            defaultValue={
                                                engineering?.bottom_depth_safety_params
                                                    ?.constant_heading_time ?? '-'
                                            }
                                            min='0'
                                            max='360'
                                            step='1'
                                        />
                                    </td>
                                </tr>
                                <tr>
                                    <td key='bottom_depth_safety_speed_label'>
                                        Update Depth Safety Speed (m/s)
                                    </td>
                                    <td>
                                        <input
                                            style={{ maxWidth: '80px' }}
                                            type='number'
                                            id='bottom_depth_safety_speed_input'
                                            name='bottom_depth_safety_speed_input'
                                            defaultValue={
                                                engineering?.bottom_depth_safety_params
                                                    ?.constant_heading_speed ?? '-'
                                            }
                                            min='0'
                                            max='3'
                                            step='any'
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </React.Fragment>
                )
            } else {
                return <div></div>
            }
        }

        return (
            <div className='panel'>
                {botSelector}
                <Button
                    className='button-jcc engineering-panel-btn'
                    type='button'
                    id='query_engineering_status'
                    onClick={this.queryEngineeringStatus.bind(this)}
                >
                    Query Selected Status
                </Button>
                <Button
                    className='button-jcc engineering-panel-btn'
                    type='button'
                    id='query_all_engineering_status'
                    onClick={this.queryAllEngineeringStatus.bind(this)}
                >
                    Query All Statuses
                </Button>
                {pidGainsTable(engineering)}
                <Button
                    className='button-jcc engineering-panel-btn'
                    type='button'
                    id='submit_gains'
                    onClick={this.submitGains.bind(this)}
                >
                    Change Gains
                </Button>
                {botRequirementsTable(engineering)}
                {botSafetyTable(engineering)}
                <Button
                    className='button-jcc engineering-panel-btn'
                    type='button'
                    id='submit_bot_requirements'
                    onClick={this.submitBotRequirements.bind(this)}
                >
                    Update Selected Bot
                </Button>
                <Button
                    className='button-jcc engineering-panel-btn'
                    type='button'
                    id='submit_all_bot_requirements'
                    onClick={this.submitAllBotRequirements.bind(this)}
                >
                    Update All Bots
                </Button>
            </div>
        )
    }

    didSelectBot(evt: Event) {
        this.botId = (evt.target as any).value
        this.forceUpdate()
    }

    queryEngineeringStatus() {
        if (!this.props.control()) return

        let botId = $('#pid_gains_bot_selector').val()
        info('Query Engineering Status for botId: ' + botId)

        let engineering_command = {
            botId: botId,
            query_engineering_status: true
        }

        debug(JSON.stringify(engineering_command))

        this.props.api.postEngineeringPanel(engineering_command)
    }

    queryAllEngineeringStatus() {
        if (!this.props.control()) return

        let botId = $('#pid_gains_bot_selector').val()
        info('Query Engineering Status for All Bots')

        for (let bot in this.state.bots) {
            let engineering_command = {
                botId: bot,
                query_engineering_status: true
            }

            debug(JSON.stringify(engineering_command))

            this.props.api.postEngineeringPanel(engineering_command)
        }
    }

    submitGains() {
        if (!this.props.control()) return

        let botId = Number($('#pid_gains_bot_selector').val())
        info('Submit gains for botId: ' + botId)

        var pid_control: any = {}
        for (let pid_type of pid_types) {
            pid_control[pid_type] = {}
            for (let pid_gain of pid_gains) {
                pid_control[pid_type][pid_gain] = Number($('#' + pid_type + '_' + pid_gain).val())
            }
        }

        let engineering_command: Engineering = {
            bot_id: botId,
            pid_control: pid_control as PIDControl
        }

        debug(JSON.stringify(engineering_command))

        this.props.api.postEngineeringPanel(engineering_command)
    }

    submitBotRequirements() {
        if (!this.props.control()) return

        let botId = Number($('#pid_gains_bot_selector').val())
        info('Submit BotStatusRate for botId: ' + botId)

        let bot_status_rate_change = this.state.bots[botId]?.engineering.bot_status_rate

        if ($('#status_rate_input').val() != -1) {
            bot_status_rate_change = $('#status_rate_input').val() as BotStatusRate
        }

        let engineering_command: Engineering = {
            bot_id: botId,
            bot_status_rate: bot_status_rate_change,
            gps_requirements: {
                transit_hdop_req: Number($('#transit_hdop_req_input').val()),
                transit_pdop_req: Number($('#transit_pdop_req_input').val()),
                after_dive_hdop_req: Number($('#after_dive_hdop_req_input').val()),
                after_dive_pdop_req: Number($('#after_dive_pdop_req_input').val()),
                transit_gps_fix_checks: Number($('#transit_gps_checks_input').val()),
                transit_gps_degraded_fix_checks: Number(
                    $('#transit_gps_degraded_checks_input').val()
                ),
                after_dive_gps_fix_checks: Number($('#after_dive_gps_checks_input').val())
            },
            rf_disable_options: {
                rf_disable_timeout_mins: Number($('#rf_disable_timeout_mins_input').val())
            },
            bottom_depth_safety_params: {
                constant_heading: Number($('#bottom_depth_safety_heading_input').val()),
                constant_heading_speed: Number($('#bottom_depth_safety_speed_input').val()),
                constant_heading_time: Number($('#bottom_depth_safety_time_input').val()),
                safety_depth: Number($('#safety_depth_input').val())
            }
        }

        debug(JSON.stringify(engineering_command))

        this.props.api.postEngineeringPanel(engineering_command)
    }

    submitAllBotRequirements() {
        if (!this.props.control()) return

        let botId = Number($('#pid_gains_bot_selector').val())
        info('Submit BotStatusRate for All Bots: ')

        let bot_status_rate_change = this.state.bots[botId]?.engineering.bot_status_rate

        if ($('#status_rate_input').val() != -1) {
            bot_status_rate_change = $('#status_rate_input').val() as BotStatusRate
        }

        for (let bot in this.state.bots) {
            let engineering_command: Engineering = {
                bot_id: Number(bot),
                bot_status_rate: bot_status_rate_change,
                gps_requirements: {
                    transit_hdop_req: Number($('#transit_hdop_req_input').val()),
                    transit_pdop_req: Number($('#transit_pdop_req_input').val()),
                    after_dive_hdop_req: Number($('#after_dive_hdop_req_input').val()),
                    after_dive_pdop_req: Number($('#after_dive_pdop_req_input').val()),
                    transit_gps_fix_checks: Number($('#transit_gps_checks_input').val()),
                    transit_gps_degraded_fix_checks: Number(
                        $('#transit_gps_degraded_checks_input').val()
                    ),
                    after_dive_gps_fix_checks: Number($('#after_dive_gps_checks_input').val())
                },
                rf_disable_options: {
                    rf_disable_timeout_mins: Number($('#rf_disable_timeout_mins_input').val())
                },
                bottom_depth_safety_params: {
                    constant_heading: Number($('#bottom_depth_safety_heading_input').val()),
                    constant_heading_speed: Number($('#bottom_depth_safety_speed_input').val()),
                    constant_heading_time: Number($('#bottom_depth_safety_time_input').val()),
                    safety_depth: Number($('#safety_depth_input').val())
                }
            }

            debug(JSON.stringify(engineering_command))

            this.props.api.postEngineeringPanel(engineering_command)
        }
    }
}
