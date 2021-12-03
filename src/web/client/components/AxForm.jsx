/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable no-unused-vars */

import React from 'react';
import PropTypes from 'prop-types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

import tooltips from '../libs/tooltips';

import AxFormField from './AxFormField';

// form styling from Bootstrap
// require('../style/normalize.less');
// require('../style/scaffolding.less');
// require('../style/bootstrap.css');
// require('../style/forms.less');
// require('../style/input-groups.less');

export default class AxForm extends React.Component {
  static formDataToParams(schema, data) {
    const params = [];
    schema.forEach((param) => {
      const value = data.get(param.name);
      const index = parseInt(param.name, 10);
      switch (param.type) {
        case 'boolean':
          params[index] = value ? 1 : 0;
          break;
        case 'integer':
          params[index] = parseInt(value, 10);
          break;
        case 'float':
          params[index] = parseFloat(value);
          break;
        case 'string':
        // Fall through
        default:
          params[index] = value;
          break;
      }
    });
    return params;
  }

  constructor(props) {
    super(props);
    this.state = { values: new Map(props.initialValues) };
    this.onFieldChange = this.onFieldChange.bind(this);

    this.formDivId = `form-${Math.round(Math.random() * 1000000000)}`;
  }

  componentDidMount() {
    const { values } = this.state;
    const { schema } = this.props;
    let changed = false;
    schema.forEach((field) => {
      if (!values.has(field.name) && Reflect.has(field, 'defaultValue')) {
        values.set(field.name, field.defaultValue);
        changed = true;
      }
    });
    this.setState({ values });
    const { onChange } = this.props;
    if (changed && onChange !== null) {
      onChange(values);
    }
    tooltips(`#${this.formDivId}`);
  }

  componentWillUnmount() {}

  onFieldChange(name, value) {
    const { values } = this.state;
    const { onChange } = this.props;
    values.set(name, value);
    this.setState({ values });
    if (onChange !== null) {
      onChange(values);
    }
  }

  handleSubmit(event) {
    // alert(`A name was submitted: ${this.state.value}`);
    const { values } = this.state;
    const { onSubmit } = this.props;
    if (onSubmit !== null) {
      onSubmit(values);
    }
    event.preventDefault();
  }

  render() {
    const {
      schema, onSubmit, onChange, readOnly
    } = this.props;
    const { values } = this.state;
    if (!schema) return 'No schema!';
    schema.sort((l, r) => {
      if (!Reflect.has(l, 'order') || !Reflect.has(r, 'order')) return 0;
      if (l.order === r.order) return 0;
      if (l.order > r.order) return 1;
      return -1;
    });
    const fields = schema.map((field) => {
      let currentFieldValue;
      if (values && values.has(field.name)) {
        currentFieldValue = values.get(field.name);
        /*
      } else if (Reflect.has(field, 'defaultValue')) {
        currentFieldValue = field.defaultValue;
        */
      }
      let allowedRole = 'any';
      if (Reflect.has(field, 'allowedRole')) {
        // eslint-disable-next-line prefer-destructuring
        allowedRole = field.allowedRole;
      }
      /* Will re-implement roles later
            if(roles.isAuthorized(role, allowedRole))
            {
            */
      return (
        <div key={field.name} className={`form-group${readOnly ? ' read-only' : ''}`}>
          <label className="col control-label" htmlFor={field.name}>
            {field.description}
          </label>
          <span className="input-group">
            <AxFormField
              type={field.type}
              name={field.name}
              value={currentFieldValue}
              options={field.inputOptions}
              onChange={this.onFieldChange}
              readOnly={readOnly}
            />
            {Reflect.has(field, 'units') ? (
              <span className={!readOnly ? 'input-group-addon' : ''}>{field.units}</span>
            ) : (
              ''
            )}
          </span>
          <span className="help-block" title={Reflect.has(field, 'helpText') ? field.helpText : ''}>
            <FontAwesomeIcon icon={faInfoCircle} />
          </span>
        </div>
      );

      /*
            }
            */
    });
    return (
      <div id={this.formDivId}>
        <form onSubmit={this.handleSubmit.bind(this)}>
          {fields}
          {onSubmit !== null && !readOnly ? (
            <div className="form-group">
              <input type="submit" value="Submit" />
            </div>
          ) : (
            ''
          )}
        </form>
      </div>
    );
  }
}

/* old live update stuff
                    {Reflect.has(field, "liveUpdate")?<script type="text/javascript">function update{deviceModel.replace(/-/g, "_") + deviceIndex + fieldName}()\{
                       axsInterface.setParam({rosparam_name},
                       $("#{deviceModel + deviceIndex} [name=\'configuration[{fieldName}]\']")'
                        +((field.type.toLowerCase() == "boolean" || field.type.toLowerCase() == "bool")?'.is(":checked")?"true":"false"':'.val()')
                        + ((field.type.toLowerCase() == "integer" || field.type.toLowerCase() == "int" || field.type.toLowerCase() == "float")?'/1.0':'')
                       });}</script>'
                       }<span className="input-group-btn"><button type="button" className="btn btn-primary" onclick="update{deviceModel.replace(/-/g, "_") + deviceIndex + fieldName}()">Live Update</button></span>':'')

                    */

AxForm.propTypes = {
  schema: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      defaultValue: PropTypes.node,
      allowedRole: PropTypes.string,
      description: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['string', 'integer', 'boolean', 'float', 'select']).isRequired,
      units: PropTypes.string,
      helpText: PropTypes.string,
      inputOptions: PropTypes.oneOfType([
        PropTypes.instanceOf(Map),
        PropTypes.shape({
          min: PropTypes.number,
          max: PropTypes.number,
          step: PropTypes.number
        })
      ])
    })
  ).isRequired,
  initialValues: PropTypes.arrayOf(PropTypes.array),
  onSubmit: PropTypes.func,
  onChange: PropTypes.func,
  readOnly: PropTypes.bool
};

AxForm.defaultProps = {
  initialValues: new Map(),
  onSubmit: null,
  onChange: null,
  readOnly: false
};
