/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */

import React from 'react';
import PropTypes from 'prop-types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExpand, faPlus, faSync, faTimes, faArrowsAlt
} from '@fortawesome/free-solid-svg-icons';
import {
  faCheckSquare, faSquare, faSave, faEdit
} from '@fortawesome/free-regular-svg-icons';

import OlMap from 'ol/Map';
import OlFormatGeoJson from 'ol/format/GeoJSON';
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import { click } from 'ol/events/condition';
import { Draw as OlDraw, Modify as OlModify, Select as OlSelect } from 'ol/interaction';

import JsonAPI from '../../common/JsonAPI';
import shapes from '../libs/shapes';

const { getWaypointStyle } = shapes;

export default class GeoEdit extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      files: [],
      loadedFiles: new Map(),
      layerExtents: new Map(),
      layerVisibility: new Map(),
    };
    const { url } = this.props;
    this.url = url;

    this.api = JsonAPI(this.url);

    this.loadList = this.loadList.bind(this);
  }

  componentDidMount() {
    this.loadList();
  }

  componentWillUnmount() {}

  loadList() {
    this.api.get('list', null).then(
      (result) => {
        if (!Array.isArray(result)) {
          console.error(result);
          // Don't throw or return rejected promise
          console.error(new Error('Failed to receive list json'));
        }
        this.setState({ files: result });
        return result;
      },
      (failReason) => {
        console.error(failReason);
      }
    );
  }

  getDataLayerFromFileName(dataFileName) {
    const { dataLayerCollection } = this.props;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < dataLayerCollection.getLength(); i++) {
      const layer = dataLayerCollection.item(i);
      if (layer.fileName === dataFileName) {
        return layer;
      }
    }
    const dataLayer = new OlVectorLayer({
      name: dataFileName,
      source: new OlVectorSource({
        features: new OlCollection(),
        wrapX: false
      }),
      style: getWaypointStyle()
    });

    dataLayer.fileName = dataFileName;

    dataLayerCollection.push(dataLayer);

    return dataLayerCollection.item(dataLayerCollection.getLength() - 1);
  }

  loadFile(fileName) {
    const { activeEditFile } = this.props;
    if (fileName === activeEditFile) {
      this.closeFile();
    }
    return this.api.get(`get/${fileName}`).then(
      (result) => {
        const { ok, name, data } = result;
        if (!ok) {
          console.error(result);
          return Promise.reject(new Error('Invalid file response'));
        }
        const dataLayer = this.getDataLayerFromFileName(name);
        dataLayer.getSource().clear();
        dataLayer.getSource().addFeatures(new OlFormatGeoJson().readFeatures(data));
        const { layerExtents, loadedFiles } = this.state;
        layerExtents.set(name, dataLayer.getSource().getExtent());
        loadedFiles.set(name, dataLayer.getSource());
        this.setState({ layerExtents, loadedFiles });
        this.showLayer(name);
        return Promise.resolve();
      },
      (failReason) => {
        console.error(failReason);
        return Promise.reject(failReason);
      }
    );
  }

  isLoaded(fileName) {
    const { loadedFiles } = this.state;
    return loadedFiles.has(fileName);
  }

  isVisible(fileName) {
    const { layerVisibility } = this.state;
    return layerVisibility.get(fileName);
  }

  showLayer(fileName) {
    if (!this.isLoaded(fileName)) {
      this.loadFile(fileName);
      return;
    }
    const dataLayer = this.getDataLayerFromFileName(fileName);
    dataLayer.setVisible(true);
    const { layerVisibility } = this.state;
    layerVisibility.set(fileName, true);
    this.setState({ layerVisibility });
  }

  hideLayer(fileName) {
    const dataLayer = this.getDataLayerFromFileName(fileName);
    dataLayer.setVisible(false);
    const { layerVisibility } = this.state;
    layerVisibility.set(fileName, false);
    this.setState({ layerVisibility });
  }

  // TODO use bind() with parameter instead of generating a function for each name
  getHandleLayerVisibilityInput(fileName) {
    const us = this;
    return function handleLayerVisibilityInput(event) {
      const nowVisible = event.target.checked;
      if (nowVisible) {
        us.showLayer(fileName);
      } else {
        us.hideLayer(fileName);
      }
    };
  }

  newFile(name) {
    const { files, loadedFiles, layerExtents } = this.state;
    files.push({ name, dateModified: Date.now() });
    const dataLayer = this.getDataLayerFromFileName(name);
    // Need to set layerExtents because for some reason we're using it to determine availability
    layerExtents.set(name, dataLayer.getSource().getExtent());
    loadedFiles.set(name, dataLayer.getSource());
    this.setState({
      files,
      loadedFiles,
      layerExtents,
    });
    this.showLayer(name);
    this.editFile(name);
  }

  editFile(fileName) {
    if (!this.isLoaded(fileName)) {
      // Come back after we've loaded the file
      this.loadFile(fileName).then(this.editFile.bind(this, fileName));
      return;
    }
    const { files } = this.state;
    const dataLayer = this.getDataLayerFromFileName(fileName);
    // Add newName field to file meta
    for (let i = 0; i < files.length; i += 1) {
      if (files[i].name === fileName) {
        files[i].newName = fileName;
        break;
      }
    }
    const { setActiveEditFile, setActiveEditLayer } = this.props;
    setActiveEditFile(fileName);
    setActiveEditLayer(dataLayer);
    /*
    changeInteraction(this.selectPointInteraction);
    this.setState({ files, activeEditFile: fileName, activeEditLayer: dataLayer });
    */
  }

  closeFile() {
    const { activeEditFile, activeFileIsDirty } = this.props;
    const { changeInteraction } = this.props;
    if (activeFileIsDirty) {
      // TODO prompt
      this.saveFile(activeEditFile).then(this.closeFile);
      return;
    }
    const dataLayer = this.getDataLayerFromFileName(activeEditFile);
    const { setActiveEditLayer, setActiveEditFile } = this.props;
    setActiveEditFile('');
    setActiveEditLayer(null);
    changeInteraction();
  }

  saveFile(fileName) {
    const dataLayer = this.getDataLayerFromFileName(fileName);
    const features = dataLayer.getSource().getFeatures();
    const geoJsonObj = new OlFormatGeoJson().writeFeaturesObject(features);
    const { files } = this.state;
    const { activeEditFile, activeFileIsDirty, setActiveFileDirty } = this.props;
    if (!activeFileIsDirty) return Promise.resolve();
    let newName = fileName;
    for (let i = 0; i < files.length; i += 1) {
      if (files[i].name === fileName) {
        // eslint-disable-next-line prefer-destructuring
        newName = files[i].newName;
        break;
      }
    }

    const us = this;
    return this.api.post(`save/${newName}`, geoJsonObj).then(
      (result) => {
        const { ok } = result;
        if (!ok) {
          console.error(result);
          return Promise.reject(new Error('Invalid file response'));
        }
        setActiveFileDirty(false);
        if (newName !== fileName) {
          // TODO delete old file
        }
        return Promise.resolve();
      },
      (failReason) => {
        console.error(failReason);
        return Promise.reject(failReason);
      }
    );
  }

  deleteFile(fileName) {
    const us = this;
    const { setActiveEditFile, setActiveEditLayer } = this.props;
    return this.api.post(`delete/${fileName}`).then(
      (result) => {
        const { ok } = result;
        if (!ok) {
          console.error(result);
          return Promise.reject(new Error('Invalid file response'));
        }
        setActiveEditFile('');
        setActiveEditLayer(null);
        us.loadList();
        return Promise.resolve();
      },
      (failReason) => {
        console.error(failReason);
        return Promise.reject(failReason);
      }
    );
  }

  zoomToFileLayerExtent(fileName) {
    if (!this.isLoaded(fileName)) {
      // Come back after we've loaded the file
      this.loadFile(fileName).then(this.zoomToFileLayerExtent.bind(this, fileName));
      return;
    }
    const { map } = this.props;
    const dataLayer = this.getDataLayerFromFileName(fileName);
    if (dataLayer.getSource().getFeatures().length < 1) {
      return;
    }
    const { mapView } = this.props;
    mapView.fit(dataLayer.getSource().getExtent(), {
      duration: 300
    });
    if (map.getView().getZoom() > 18) {
      map.getView().setZoom(18);
    }
    map.render();
  }

  changeFileName(oldName, event) {
    const { files } = this.state;
    for (let i = 0; i < files.length; i += 1) {
      if (files[i].name === oldName) {
        files[i].newName = event.target.value.toString();
        break;
      }
    }
    this.setState({ files });
    const { setActiveFileDirty } = this.props;
    setActiveFileDirty(true);
  }

  render() {
    const {
      files
    } = this.state;
    const {
      activeEditFile, activeFileIsDirty
    } = this.props;

    return (
      <div>
        <button type="button" onClick={this.loadList} title="Refresh">
          <FontAwesomeIcon icon={faSync} />
        </button>
        <button type="button" onClick={this.newFile.bind(this, 'New_File')} title="Create New File">
          <FontAwesomeIcon icon={faPlus} />
        </button>
        {Array.isArray(files) && files.length > 0 ? (
          <table>
            <thead>
              <tr>
                <td />
                <td>Name</td>
                <td>GoTo</td>
                <td>Edit</td>
              </tr>
            </thead>
            <tbody>
              {files.map(file => (
                <tr key={file.name} className={file.name === activeEditFile ? 'row-selected' : ''}>
                  <td>
                    {this.isVisible(file.name) ? (
                      <button
                        type="button"
                        className="buttonCheckbox"
                        onClick={this.hideLayer.bind(this, file.name)}
                      >
                        <FontAwesomeIcon icon={faCheckSquare} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="buttonCheckbox"
                        onClick={this.showLayer.bind(this, file.name)}
                      >
                        <FontAwesomeIcon icon={faSquare} />
                      </button>
                    )}
                  </td>
                  <td className="name">
                    {activeEditFile && activeEditFile === file.name ? (
                      <input
                        type="text"
                        name="newFileName"
                        value={file.newName}
                        onChange={this.changeFileName.bind(this, file.name)}
                      />
                    ) : (
                      <span
                        title={(() => {
                          const fileDate = new Date(file.dateModified);
                          return fileDate.toISOString();
                        })()}
                      >
                        {file.name}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={this.zoomToFileLayerExtent.bind(this, file.name)}
                      title="GoTo"
                    >
                      <FontAwesomeIcon icon={faExpand} />
                    </button>
                  </td>
                  <td>
                    {activeEditFile && activeEditFile === file.name ? (
                      <span>
                        <button
                          type="button"
                          onClick={this.saveFile.bind(this, file.name)}
                          title="Save"
                          className={activeFileIsDirty ? '' : 'inactive'}
                        >
                          <FontAwesomeIcon icon={faSave} />
                        </button>
                        <button
                          type="button"
                          onClick={this.closeFile.bind(this)}
                          title="Close"
                          className={activeFileIsDirty ? 'inactive' : ''}
                        >
                          <FontAwesomeIcon icon={faTimes} />
                        </button>
                      </span>
                    ) : (
                      ''
                    )}
                    {!activeEditFile ? (
                      <button
                        type="button"
                        onClick={this.editFile.bind(this, file.name)}
                        title="Edit"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          ''
        )}
      </div>
    );
  }
}

GeoEdit.propTypes = {
  url: PropTypes.string.isRequired,
  dataLayerCollection: PropTypes.instanceOf(OlCollection).isRequired,
  map: PropTypes.instanceOf(OlMap).isRequired,
  changeInteraction: PropTypes.func.isRequired,
  setActiveEditFile: PropTypes.func.isRequired,
  setActiveEditLayer: PropTypes.func.isRequired,
  mapView: PropTypes.shape({
    centerOn: PropTypes.func.isRequired,
    fit: PropTypes.func.isRequired
  }).isRequired,
  activeFileIsDirty: PropTypes.bool.isRequired,
  setActiveFileDirty: PropTypes.func.isRequired,
};

GeoEdit.defaultProps = {};
