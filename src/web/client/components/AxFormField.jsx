/* eslint-disable no-unused-vars */

import React from 'react';

const PropTypes = require('prop-types');

export default class AxFormField extends React.Component {
  constructor(props) {
    super(props);
    this.options = props.options || {};
    this.handleInputChange = this.handleInputChange.bind(this);
  }

  componentDidMount() {}

  componentWillUnmount() {}

  handleInputChange(event) {
    const { target } = event;
    const { name } = target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const { onChange } = this.props;
    onChange(name, value);
  }

  render() {
    const {
      type, name, value, readOnly
    } = this.props;
    if (type && typeof type === 'string') {
      switch (type.toLowerCase()) {
        case 'string':
        case 'text':
          if (readOnly) return <span className="form-control">{value}</span>;
          return (
            <input type="text" name={name} value={value} onChange={this.handleInputChange} className="form-control" />
          );
        case 'integer':
        case 'int':
        case 'float':
          if (readOnly) return <span className="form-control">{value}</span>;
          return (
            <input
              type="number"
              className="form-control"
              name={name}
              value={value}
              onChange={this.handleInputChange}
              step={this.options.step || ''}
              max={this.options.max || ''}
              min={this.options.min || ''}
            />
          );
        case 'boolean':
        case 'bool': {
          const trueString = this.options.trueString || 'Yes';
          const falseString = this.options.falseString || 'No';
          if (readOnly) return <span className="form-control">{value ? trueString : falseString}</span>;
          return (
            <input
              type="checkbox"
              data-on-color="primary"
              name={name}
              value={value ? ' checked' : ''}
              onChange={this.handleInputChange}
              className="input-switch"
              data-size="medium"
              data-on-text={trueString}
              data-off-text={falseString}
            />
          );
        }
        case 'select': {
          if (readOnly) return <span className="form-control">{this.options[value]}</span>;
          const optionItems = this.options
            .keys()
            .map(key => <option value={this.options[key]}>{this.options[key]}</option>);
          return (
            <select name={name} value={value} onChange={this.handleInputChange} className="form-control">
              <option />
              {optionItems}
            </select>
          );
        }
        default:
          if (readOnly) return <span className="form-control">{value}</span>;
          return (
            <input type="text" name={name} value={value} onChange={this.handleInputChange} className="form-control" />
          );
      }
    }
    if (readOnly) return <span className="form-control">{value}</span>;
    return <input type="text" name={name} value={value} onChange={this.handleInputChange} className="form-control" />;
  }
}

AxFormField.propTypes = {
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string]),
  options: PropTypes.oneOfType([
    PropTypes.instanceOf(Map),
    PropTypes.shape({
      min: PropTypes.number,
      max: PropTypes.number,
      step: PropTypes.number
    })
  ]),
  onChange: PropTypes.func.isRequired,
  readOnly: PropTypes.bool
};

AxFormField.defaultProps = {
  value: '',
  options: {},
  readOnly: false
};
