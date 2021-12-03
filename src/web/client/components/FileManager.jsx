import React from 'react';
import PropTypes from 'prop-types';

import SweetAlert from 'sweetalert';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExpand, faPlus, faSync, faTimes, faArrowsAlt, faTrashAlt
} from '@fortawesome/free-solid-svg-icons';
import {
  faCheckSquare, faSquare, faSave, faEdit, faFolderOpen
} from '@fortawesome/free-regular-svg-icons';

import {
  error, success, warning, info, debug
} from '../libs/notifications';

import JsonAPI from '../../common/JsonAPI';

import uploadIcon from '../icons/upload.png'

function identity(thing) {
  return thing;
}

export default class FileManager extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      availableFiles: []
    };
    const { source } = this.props;
    this.url = source;

    this.api = JsonAPI(this.url);

    this.newFileButton = (
      <button type="button" onClick={this.newFile.bind(this)} title="Create New File">
        <FontAwesomeIcon icon={faPlus} />
      </button>
    );

    this.loadList = this.loadList.bind(this);
    this.uploadFileInput = <input type="file" id="upload-input" multiple accept="application/json" style={{display:'none'}} onChange={this.didUploadFiles.bind(this)} />
  }

  // Called when user taps the "Upload" button to upload a mission file
  uploadClicked(event) {
    let uploadInputElement = document.getElementById("upload-input")
    uploadInputElement.click()
  }

  // Called after user selects files to upload
  didUploadFiles() {
    let uploadInputElement = document.getElementById("upload-input")
    
    const importMissionData = this.importMissionData.bind(this)
    
    for (let i=0; i<uploadInputElement.files.length; i++) {
      const file = uploadInputElement.files[i]
      
      const reader = new FileReader();
      reader.onload = function(e) {
      
        try {
          let missionData = JSON.parse(e.target.result)
          importMissionData(file.name.replace('.json', ''), missionData)
        }
        catch(err) {
          info(err)
        }
        
      }
      reader.readAsBinaryString(file)
    }
  }

  // Import a new mission
  importMissionData(name, missionData) {
    this.api.post(`save/${name}`, missionData).then(
          (result) => {
            const { ok } = result;
            if (!ok) {
              console.error(result);
              return Promise.reject(new Error('Invalid file response'));
            }
            info("Imported mission: " + name)
            
            this.loadList()
            
            return Promise.resolve();
          },
          (failReason) => {
            info("Failed to import mission " + name + ": " + failReason)
            console.error(failReason);
            return Promise.reject(failReason);
          }
        )  
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
        this.setState({ availableFiles: result });
        return result;
      },
      (failReason) => {
        console.error(failReason);
      }
    );
  }

  loadFile(fileName) {
    const { loadedFileData } = this.props;
    const file = loadedFileData.get(fileName) || {
      name: fileName,
      data: null,
      isActiveEdit: false,
      isDirty: false,
      isLocked: false,
      isVisible: true
    };
    if (file.isActiveEdit) {
      return this.closeFile(fileName).then(this.loadFile(fileName));
    }
    return this.api.get(`get/${fileName}`).then(
      (result) => {
        const { ok, name, data } = result;
        if (!ok) {
          console.error(result);
          return Promise.reject(new Error('Invalid file response'));
        }
        const { denormalizeDataForUsage } = this.props;
        file.data = denormalizeDataForUsage(data);
        file.isDirty = false;
        const { loadData } = this.props;
        loadData(name, file);
        return Promise.resolve(file);
      },
      (failReason) => {
        console.error(failReason);
        return Promise.reject(failReason);
      }
    );
  }

  isLoaded(fileName) {
    const { loadedFileData } = this.props;
    return loadedFileData.has(fileName);
  }

  isDirty(fileName) {
    const { loadedFileData } = this.props;
    return loadedFileData.has(fileName) ? loadedFileData.get(fileName).isDirty : false;
  }

  isVisible(fileName) {
    const { loadedFileData } = this.props;
    return loadedFileData.has(fileName) ? loadedFileData.get(fileName).isVisible : false;
  }

  isLocked(fileName) {
    const { loadedFileData } = this.props;
    return loadedFileData.has(fileName) ? loadedFileData.get(fileName).isLocked : false;
  }

  isEmpty(fileName) {
    const { loadedFileData } = this.props;
    return loadedFileData.has(fileName) ? loadedFileData.get(fileName).data == null : true;
  }

  newFile() {
    const { availableFiles } = this.state;
    const { loadedFileData, createNewDataObject, loadData } = this.props;
    const newData = createNewDataObject();
    // TODO check for file with same name
    availableFiles.push({ name: newData.name, dateModified: Date.now(), newFile: true });
    loadData(newData.name, newData);
    this.setState({
      availableFiles
    });
    this.editFile(newData.name);
  }

  editFile(fileName) {
    if (!this.isLoaded(fileName)) {
      // Come back after we've loaded the file
      this.loadFile(fileName).then(this.editFile.bind(this, fileName));
      return;
    }
    const { availableFiles } = this.state;
    // Add newName field to file meta
    for (let i = 0; i < availableFiles.length; i += 1) {
      if (availableFiles[i].name === fileName) {
        availableFiles[i].newName = fileName;
        break;
      }
    }
    const { setMode, setActiveEditFile } = this.props;
    setActiveEditFile(fileName);
    setMode('edit');
  }

  closeFile(fileName) {
    const { loadedFileData } = this.props;
    const { setMode, setActiveEditFile } = this.props;
    const file = loadedFileData.get(fileName);
    const us = this;
    if (file) {
      if (file.isDirty) {
        SweetAlert({
          title: 'Unsaved changes',
          text: 'Would you like to save your changes first?',
          buttons: {
            save: 'Save and Close',
            close: 'Close without saving',
            cancel: true
          }
        }).then((value) => {
          switch (value) {
            case 'save':
              us.saveFile(fileName).then(() => this.closeFile(fileName));
              break;
            case 'close':
              setActiveEditFile('');
              us.loadList();
              setMode('closed');
              break;
            default:
              break;
          }
        });
      } else {
        setActiveEditFile('');
        this.loadList();
        setMode('closed');
      }
    } else {
      console.error(`Tried to close non-existent file ${fileName}`);
    }
  }

  saveFile(fileName) {
    const { availableFiles } = this.state;
    const { loadedFileData, setFileDirty } = this.props;
    if (!loadedFileData.get(fileName).isDirty) return Promise.resolve();
    let newName = fileName;
    for (let i = 0; i < availableFiles.length; i += 1) {
      if (availableFiles[i].name === fileName) {
        if (Reflect.has(availableFiles[i], 'newName')) {
          // eslint-disable-next-line prefer-destructuring
          newName = availableFiles[i].newName;
        }
        break;
      }
    }

    const { normalizeDataForStorage, denormalizeDataForUsage } = this.props;
    const us = this;
    const normalizedData = normalizeDataForStorage(loadedFileData.get(fileName).data);
    const { loadData, createNewDataObject } = this.props;
    return this.api.post(`save/${newName}`, normalizedData).then(
      (result) => {
        const { ok } = result;
        if (!ok) {
          console.error(result);
          return Promise.reject(new Error('Invalid file response'));
        }
        if (newName !== fileName) {
          for (let i = 0; i < availableFiles.length; i += 1) {
            if (availableFiles[i].name === fileName) {
              if (availableFiles[i].newFile) {
                availableFiles[i].newFile = false;
                availableFiles[i].name = newName;
              } else {
                const availFile = Object.assign({}, availableFiles[i]);
                availFile.name = newName;
                availableFiles.push(availFile);
                loadData(newName, Object.assign({}, createNewDataObject()));
                // setMode('edit');
//                 this.deleteFile(fileName, true);
              }
              break;
            }
          }
        }
        const { setMode, setActiveEditFile } = this.props;
        loadData(
          newName,
          Object.assign({}, loadedFileData.get(newName), {
            data: denormalizeDataForUsage(normalizedData),
            name: newName
          })
        );
        setFileDirty(newName, false);
        setActiveEditFile(newName);
        info(`File ${newName} saved`);
        return Promise.resolve();
      },
      (failReason) => {
        console.error(failReason);
        return Promise.reject(failReason);
      }
    );
  }

  deleteFile(fileName, rename = false) {
    const us = this;
    const { setActiveEditFile, loadedFileData } = this.props;
    return this.api.post(`delete/${fileName}`).then(
      (result) => {
        const { ok } = result;
        if (!ok) {
          console.error(result);
          return Promise.reject(new Error('Invalid file response'));
        }
        if (!rename) {
          setActiveEditFile('');
          info(`File ${fileName} deleted`);
          us.loadList();
        }
        return Promise.resolve();
      },
      (failReason) => {
        console.error(failReason);
        return Promise.reject(failReason);
      }
    );
  }

  confirmDeleteFile(fileName) {
    const us = this;
    SweetAlert({
      title: 'Are you sure?',
      text: 'Once deleted, you will not be able to recover this file!',
      icon: 'warning',
      buttons: true,
      dangerMode: true
    }).then((willDelete) => {
      if (willDelete) {
        us.deleteFile(fileName);
      } else {
        info('Canceled file delete.');
      }
    });
  }

  changeFileName(oldName, event) {
    const { availableFiles } = this.state;
    for (let i = 0; i < availableFiles.length; i += 1) {
      if (availableFiles[i].name === oldName) {
        availableFiles[i].newName = event.target.value.toString();
        break;
      }
    }
    this.setState({ availableFiles });
    const { setFileDirty } = this.props;
    setFileDirty(oldName, true);
  }

  setVisible(name, visible) {
    const { setDataVisibility } = this.props;
    if (!this.isLoaded(name)) {
      this.loadFile(name).then(
        (result) => {
          this.setVisible(name, visible);
        },
        (failReason) => {
          console.error(failReason);
        }
      );
      return;
    }
    setDataVisibility(name, visible);
  }

  zoomTo(name) {
    const { zoomToFileLayerExtent } = this.props;
    if (!this.isLoaded(name)) {
      this.loadFile(name).then(
        (result) => {
          this.zoomTo(name);
        },
        (failReason) => {
          console.error(failReason);
        }
      );
      return;
    }
    zoomToFileLayerExtent(name);
  }

  render() {
    const { availableFiles } = this.state;
    const {
      mode,
      setMode,
      loadedFileData,
      zoomToFileLayerExtent,
      setDataVisibility,
      setFileDirty,
      additionalFileActions
    } = this.props;

    switch (mode) {
      case 'unified': {
        return (
          <div className="file-manager file-manager-unified">
            <button type="button" onClick={this.loadList} title="Refresh">
              <FontAwesomeIcon icon={faSync} />
            </button>
            {this.newFileButton}
            {Array.isArray(availableFiles) && availableFiles.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <td />
                    <td>Name</td>
                    <td>GoTo</td>
                    <td>Edit</td>
                    <td />
                  </tr>
                </thead>
                <tbody>
                  {availableFiles.map((file) => {
                    const fileData = loadedFileData.get(file.name) || {};
                    const isActiveEditFile = fileData.isActiveEdit || false;
                    const isFileDirty = fileData.isDirty || false;
                    const isFileVisible = fileData.isVisible || false;
                    const isFileLocked = fileData.isLocked || false;
                    const isFileLoaded = this.isLoaded(file.name);
                    return (
                      <tr key={file.name} className={isActiveEditFile ? 'row-selected' : ''}>
                        <td>
                          {this.isVisible(file.name) ? (
                            <button
                              type="button"
                              className="buttonCheckbox"
                              onClick={this.setVisible.bind(this, file.name, false)}
                            >
                              <FontAwesomeIcon icon={faCheckSquare} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="buttonCheckbox"
                              onClick={this.setVisible.bind(this, file.name, true)}
                            >
                              <FontAwesomeIcon icon={faSquare} />
                            </button>
                          )}
                        </td>
                        <td className="name">
                          {isActiveEditFile ? (
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
                          <button type="button" onClick={this.zoomTo.bind(this, file.name)} title="GoTo">
                            <FontAwesomeIcon icon={faExpand} />
                          </button>
                        </td>
                        <td>
                          {isActiveEditFile ? (
                            <span>
                              <button
                                type="button"
                                onClick={this.saveFile.bind(this, file.name)}
                                title="Save"
                                className={isFileDirty ? '' : 'inactive'}
                              >
                                <FontAwesomeIcon icon={faSave} />
                              </button>
                              <button
                                type="button"
                                onClick={this.closeFile.bind(this, file.name)}
                                title="Close"
                                className={isFileDirty ? 'inactive' : ''}
                              >
                                <FontAwesomeIcon icon={faTimes} />
                              </button>
                            </span>
                          ) : (
                            ''
                          )}
                          {!isActiveEditFile && !isFileLocked ? (
                            <span>
                              <button type="button" onClick={this.editFile.bind(this, file.name)} title="Edit">
                                <FontAwesomeIcon icon={faEdit} />
                              </button>
                            </span>
                          ) : (
                            ''
                          )}
                        </td>
                        <td>
                          {isFileLoaded && !isActiveEditFile && !isFileLocked ? (
                            <span>
                              {additionalFileActions.length > 0
                                ? additionalFileActions.map(action => (
                                  <button
                                    key={action.name}
                                    type="button"
                                    onClick={action.callback.bind(null, file.name)}
                                    title={action.description}
                                  >
                                    {action.icon ? action.icon : action.name}
                                  </button>
                                ))
                                : ''}
                            </span>
                          ) : (
                            ''
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              ''
            )}
          </div>
        );
      }
      case 'closed': {
        return (
          <div className="file-manager file-manager-closed">
            {this.newFileButton}
            <button type="button" onClick={setMode.bind(null, 'list')} title="Open Mission Plan File">
              <FontAwesomeIcon icon={faFolderOpen} />
            </button>
            {this.uploadFileInput}
            <button id="fileSelect" onClick={this.uploadClicked.bind(this)}>
              <img src={uploadIcon} alt="Upload" width="22" height="22" /> Upload
            </button>
          </div>
        );
      }
      case 'list': {
        return (
          <div className="file-manager file-manager-list">
            <button type="button" onClick={this.loadList} title="Refresh">
              <FontAwesomeIcon icon={faSync} />
            </button>
            <button type="button" onClick={setMode.bind(null, 'closed')} title="Cancel">
              Cancel
            </button>
            {Array.isArray(availableFiles) && availableFiles.length > 0 ? (
              <div>
                <table>
                  <tbody>
                    {availableFiles.map((file) => {
                      const fileData = loadedFileData.get(file.name) || {};
                      const isActiveEditFile = fileData.isActiveEdit || false;
                      const isFileDirty = fileData.isDirty || false;
                      const isFileVisible = fileData.isVisible || false;
                      const isFileLocked = fileData.isLocked || false;
                      const isFileLoaded = this.isLoaded(file.name);
                      return (
                        <tr key={file.name} className="file-listing">
                          <td className="file-name">
                            <button
                              type="button"
                              className="not-a-button"
                              onClick={this.editFile.bind(this, file.name)}
                              title={(() => {
                                const fileDate = new Date(file.dateModified);
                                return fileDate.toISOString();
                              })()}
                            >
                              {file.name}
                            </button>
                          </td>
                          <td className="file-delete">
                            <button
                              type="button"
                              onClick={this.confirmDeleteFile.bind(this, file.name)}
                              title="Delete File"
                            >
                              <FontAwesomeIcon icon={faTrashAlt} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              ''
            )}
          </div>
        );
      }
      case 'edit': {
        const { activeEditFile } = this.props;
        const fileData = loadedFileData.get(activeEditFile) || {};
        const isActiveEditFile = fileData.isActiveEdit || false;
        const isFileDirty = fileData.isDirty || false;
        const isFileVisible = fileData.isVisible || false;
        const isFileLocked = fileData.isLocked || false;
        const isFileLoaded = this.isLoaded(activeEditFile);
        let newName = activeEditFile;
        availableFiles.forEach((file) => {
          // eslint-disable-next-line prefer-destructuring
          if (file.name === activeEditFile) newName = file.newName;
        });
        return (
          <div className="file-manager file-manager-edit">
            <input
              type="text"
              name="newFileName"
              value={newName}
              onChange={this.changeFileName.bind(this, activeEditFile)}
            />
            <span>
              <button
                type="button"
                onClick={this.saveFile.bind(this, activeEditFile)}
                title="Save"
                className={isFileDirty ? '' : 'inactive'}
              >
                <FontAwesomeIcon icon={faSave} />
              </button>
              <button type="button" onClick={this.closeFile.bind(this, activeEditFile)} title="Close">
                <FontAwesomeIcon icon={faTimes} />
              </button>
              <span className="additionalFileActions">
                {additionalFileActions.length > 0
                  ? additionalFileActions.map(action => (
                    <button
                      key={action.name}
                      type="button"
                      className={isFileDirty ? 'inactive' : ''}
                      onClick={
                          !isFileDirty
                            ? action.callback.bind(null, activeEditFile)
                            : () => {
                              info('Please save first');
                            }
                        }
                      title={action.description}
                    >
                      {action.icon ? action.icon : action.name}
                    </button>
                  ))
                  : ''}
              </span>
            </span>
          </div>
        );
      }
      case 'view': {
        const { activeViewFile } = this.props;
        const fileData = loadedFileData.get(activeViewFile) || {};
        const isActiveEditFile = fileData.isActiveEdit || false;
        const isFileDirty = fileData.isDirty || false;
        const isFileVisible = fileData.isVisible || false;
        const isFileLocked = fileData.isLocked || false;
        const isFileLoaded = this.isLoaded(activeViewFile);
        return (
          <div className="file-manager file-manager-view">
            <span
              title={(() => {
                const fileDate = new Date(fileData.dateModified);
                return fileDate.toISOString();
              })()}
            >
              {activeViewFile}
            </span>
            <button
              type="button"
              onClick={this.closeFile.bind(this, activeViewFile)}
              title="Close"
              className={isFileDirty ? 'inactive' : ''}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        );
      }
      default:
        return 'Invalid FileManager mode';
    }
  }
}

FileManager.propTypes = {
  source: PropTypes.string.isRequired, // URL of file mgmt api
  loadedFileData: PropTypes.instanceOf(Map).isRequired, // Container with data, name: {data, dirty, visible, locked, extents?/layer?, type?}
  mode: PropTypes.oneOf(['unified', 'closed', 'list', 'edit', 'view']),
  activeEditFile: PropTypes.string,
  activeViewFile: PropTypes.string,
  // Callbacks for data serialization
  normalizeDataForStorage: PropTypes.func, // Function that takes app data and returns JSON-able object. Defaults to the identity function (i.e. obj => obj)
  denormalizeDataForUsage: PropTypes.func, // Function that takes data from JSON file and returns object in app format. Defaults to the identity function (i.e. obj => obj)
  // Callbacks for pushing up file state
  setMode: PropTypes.func.isRequired, // Function that allows to set mode of this file manager
  loadData: PropTypes.func.isRequired, // Function that accepts a file name and app-format data to store (so file contents are in parent state instead of ours)
  createNewDataObject: PropTypes.func.isRequired, // Function that returns new empty data object
  setFileDirty: PropTypes.func.isRequired, // Function that sets dirty flag for a given file
  //  setFileLocked: PropTypes.func, // Function that sets locked flag for a given file
  setDataVisibility: PropTypes.func.isRequired, // Function that sets data layer visibility
  setActiveEditFile: PropTypes.func.isRequired, // Function that activates editing for a particular file
  // Other Callbacks
  zoomToFileLayerExtent: PropTypes.func.isRequired,
  additionalFileActions: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      callback: PropTypes.func.isRequired,
      icon: PropTypes.node
    })
  )
};

FileManager.defaultProps = {
  mode: 'unified',
  activeEditFile: '',
  activeViewFile: '',
  normalizeDataForStorage: identity,
  denormalizeDataForUsage: identity,
  additionalFileActions: []
};
