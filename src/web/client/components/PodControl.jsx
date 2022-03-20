/* eslint-disable no-unused-vars */

import React from 'react';

import $ from 'jquery';
import 'jquery-ui/ui/widgets/slider';
import 'jquery-ui/themes/base/slider.css';

import JaiaAPI from '../../common/JaiaAPI';

import AxForm from './AxForm';

const PropTypes = require('prop-types');
import { info } from '../libs/notifications'

export default class PodControl extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
    this.didSend = function(id, params) {
      info("Sent Command")
    }
  }

  componentDidMount() {
    const { sna } = this.props;
    const us = this;
  }

  componentWillUnmount() {}

  sendStop() {
    const { sna } = this.props;
    sna.allStop();
  }

  render() {
    const {
      error,
    } = this.state;
    return (
      <div>
        {error || ''}
        <button type="button" style={{"backgroundColor":"red"}} onClick={this.sendStop.bind(this)}>
          Stop
        </button>
      </div>
    );
  }
}

PodControl.propTypes = {
  sna: PropTypes.instanceOf(JaiaAPI).isRequired
};
