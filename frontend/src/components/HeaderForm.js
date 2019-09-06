import React, { Component } from 'react';
import { Container, Row, Col, Form, Label, Input, Alert } from 'reactstrap';
import { dataOriginTypes } from '../enums';
// import defaultConfig from '../config.default.json';
import config from '../config.json';
import DataPositionFormRow from './DataPositionFormRow';
import MountedDataFormRow from './MountedDataFormRow';
import FileUploadFormRow from './FileUploadFormRow';
import ExampleSelectButtons from './ExampleSelectButtons';
import SparqlDataFormRow from "./SparqlDataFormRow";

const BACKEND_URL = config.BACKEND_URL || `http://${window.location.host}`;
const DATA_SOURCES = config.DATA_SOURCES;
const MAX_UPLOAD_SIZE_DESCRIPTION = '5 MB';
const dataTypes = {
  BUILT_IN: 'built-in',
  FILE_UPLOAD: 'file-upload',
  MOUNTED_FILES: 'mounted files',
  EXAMPLES: 'examples',
  SPARQL: 'sparql'
};

class HeaderForm extends Component {
  state = {
    xgSelectOptions: ['none'],
    xgSelect: 'none',

    gbwtSelectOptions: ['none'],
    gbwtSelect: 'none',

    gamSelectOptions: ['none'],
    gamSelect: 'none',

    pathSelectOptions: ['none'],
    pathSelect: 'none',

    sparqlSelect: 'http://localhost:8088/sparql/',

    xgFile: 'snp1kg-BRCA1.vg.xg',
    gbwtFile: '',
    gamFile: 'NA12878-BRCA1.sorted.gam',
    anchorTrackName: '17',
    dataPath: 'default',

    nodeID: '1',
    distance: '100',
    byNode: 'false',

    dataType: dataTypes.BUILT_IN,
    fileSizeAlert: false,
    uploadInProgress: false
  };

  componentDidMount() {
    this.getMountedFilenames();
    this.setUpWebsocket();
  }

  getMountedFilenames = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/getFilenames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const json = await response.json();
      json.xgFiles.unshift('none');
      json.gbwtFiles.unshift('none');
      json.gamIndices.unshift('none');

      this.setState(state => {
        const xgSelect = json.xgFiles.includes(state.xgSelect)
          ? state.xgSelect
          : 'none';
        const gbwtSelect = json.gbwtFiles.includes(state.gbwtSelect)
          ? state.gbwtSelect
          : 'none';
        const gamSelect = json.gamIndices.includes(state.gamSelect)
          ? state.gamSelect
          : 'none';
        return {
          xgSelectOptions: json.xgFiles,
          gbwtSelectOptions: json.gbwtFiles,
          gamSelectOptions: json.gamIndices,
          xgSelect,
          gbwtSelect,
          gamSelect
        };
      });
    } catch (error) {
      console.log('POST to /getFilenames failed');
    }
  };

  updatePathNamesFromSparql = async () => {
    const sparqlAcceptHeader = {
      'Accept': 'application/sparql-results+json'
    };
    try {
        const fetchedData = await fetch (`${this.state.sparqlSelect}?query=PREFIX vg:<http://biohackathon.org/resource/vg%23> SELECT DISTINCT ?pathname WHERE { ?step vg:path ?pathname } ORDER BY ?pathname`, { headers: sparqlAcceptHeader });
        const fetchedJson = await fetchedData.json();
        const lpso = fetchedJson.results.bindings.map(p => p.pathname.value);
        console.log(lpso);

        this.setState(state => {
            const pathSelect = lpso.includes(state.pathSelect)
                ? state.pathSelect
                : lpso[0];
            return {
                pathSelectOptions: lpso,
                pathSelect,
                anchorTrackName: pathSelect
            };
        });
    } catch (error) {
      console.log(error);
      console.log('GETTING sparql path names failed');
    }
  }

  getPathNames = async (xgFile, isUploadedFile) => {
    try {
      const response = await fetch(`${BACKEND_URL}/getPathNames`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ xgFile, isUploadedFile })
      });
      const json = await response.json();
      this.setState(state => {
        const pathSelect = json.pathNames.includes(state.pathSelect)
          ? state.pathSelect
          : json.pathNames[0];
        return {
          pathSelectOptions: json.pathNames,
          pathSelect,
          anchorTrackName: pathSelect
        };
      });
    } catch (error) {
      console.log('POST to /getPathNames failed');
    }
  };

  resetPathNames = () => {
    this.setState({
      pathSelectOptions: ['none'],
      pathSelect: 'none'
    });
  };

  handleDataSourceChange = event => {
    const value = event.target.value;
    DATA_SOURCES.forEach(ds => {
      if (ds.name === value) {
        this.setState({
          xgFile: ds.xgFile,
          gbwtFile: ds.gbwtFile,
          gamFile: ds.gamFile,
          anchorTrackName: ds.anchorTrackName,
          dataPath: ds.useMountedPath ? 'mounted' : 'default',
          nodeID: ds.defaultPosition,
          dataType: dataTypes.BUILT_IN
        });
        return;
      }
    });
    if (value === 'customFileUpload') {
      this.setState(state => {
        return {
          xgFile: state.xgSelect,
          gbwtFile: state.gbwtSelect,
          gamFile: state.gamSelect,
          anchorTrackName: state.pathSelect,
          dataPath: 'upload',
          dataType: dataTypes.FILE_UPLOAD
        };
      });
    } else if (value === 'customMounted') {
      this.setState(state => {
        return {
          xgFile: state.xgSelect,
          gbwtFile: state.gbwtSelect,
          gamFile: state.gamSelect,
          anchorTrackName: state.pathSelect,
          dataPath: 'mounted',
          dataType: dataTypes.MOUNTED_FILES
        };
      });
    } else if (value === 'syntheticExamples') {
      this.setState({ dataType: dataTypes.EXAMPLES });
    } else if (value === 'sparqlBackend') {  
      this.updatePathNamesFromSparql();
      this.props.setDataOrigin( dataOriginTypes.SPARQL);
      this.setState(state => {
        return {
          dataOrigin: dataTypes.sparql,
          dataType: dataTypes.SPARQL,
          anchorTrackName: state.pathSelect,
          dataPath: 'sparql',
          distance: '10',
          byNode: 'true',
        };
      });
    }
  };

  handleGoButton = () => {
    if (this.props.dataOrigin !== dataOriginTypes.API) {
      this.props.setColorSetting('haplotypeColors', 'greys');
      this.props.setColorSetting('forwardReadColors', 'reds');
    }
    const fetchParams = {
      nodeID: this.state.nodeID,
      distance: this.state.distance,
      byNode: this.state.byNode,
      xgFile: this.state.xgFile,
      gbwtFile: this.state.gbwtFile,
      gamFile: this.state.gamFile,
      anchorTrackName: this.state.anchorTrackName,
      dataPath: this.state.dataPath,
      sparqlSelect: this.state.sparqlSelect
    };
    this.props.setFetchParams(fetchParams);
  };

  handleInputChange = event => {
    const id = event.target.id;
    const value = event.target.value;
    this.setState({ [id]: value });
    if (id === 'xgSelect') {
      this.getPathNames(value, false);
      this.setState({ xgFile: value });
    } else if (id === 'gbwtSelect') {
      this.setState({ gbwtFile: value });
    } else if (id === 'gamSelect') {
      this.setState({ gamFile: value });
    } else if (id === 'pathSelect') {
      this.setState({ anchorTrackName: value });
    }
  };

  handleGoRight = () => {
    this.setState(
      state => ({
        nodeID: Number(this.state.nodeID) + Number(this.state.distance)
      }),
      () => this.handleGoButton()
    );
  };

  handleGoLeft = () => {
    this.setState(
      state => ({
        nodeID: Math.max(
          0,
          Number(this.state.nodeID) - Number(this.state.distance)
        )
      }),
      () => this.handleGoButton()
    );
  };

  handleFileUpload = (fileType, fileName) => {
    this.setState({ [fileType]: fileName });
  };

  showFileSizeAlert = () => {
    this.setState({ fileSizeAlert: true });
  };

  setUploadInProgress = val => {
    this.setState({ uploadInProgress: val });
  };

  setUpWebsocket = () => {
    console.log(BACKEND_URL);
    this.ws = new WebSocket(BACKEND_URL.replace(/^http/, 'ws'));
    this.ws.onmessage = message => {
      this.getMountedFilenames();
    };
    this.ws.onclose = event => {
      setTimeout(this.setUpWebsocket, 1000);
    };
    this.ws.onerror = event => {
      this.ws.close();
    };
  };

  render() {
    let dataSourceDropdownOptions = DATA_SOURCES.map(ds => {
      return (
        <option value={ds.name} key={ds.name}>
          {ds.name}
        </option>
      );
    });
    dataSourceDropdownOptions.push(
      <option value="syntheticExamples" key="syntheticExamples">
        synthetic data examples
      </option>,
      <option value="customFileUpload" key="customFileUpload">
        custom (file upload)
      </option>,
      <option value="customMounted" key="customMounted">
        custom (mounted files)
      </option>,
      <option value="sparqlBackend" key="sparqlBackend">
        SPARQL Backend
      </option>
    );

    const mountedFilesFlag = this.state.dataType === dataTypes.MOUNTED_FILES;
    const uploadFilesFlag = this.state.dataType === dataTypes.FILE_UPLOAD;
    const examplesFlag = this.state.dataType === dataTypes.EXAMPLES;
    const sparqlFlag = this.state.dataType === dataTypes.SPARQL;

    return (
      <div>
        <Container fluid={true}>
          <Row>
            <Col md="auto">
              <img src="./logo.png" alt="Logo" />
            </Col>
            <Col>
              <Form inline>
                <Label
                  className="tight-label mb-2 mr-sm-2 mb-sm-0 ml-2"
                  for="dataSourceSelect"
                >
                  Data:
                </Label>
                <Input
                  type="select"
                  id="dataSourceSelect"
                  className="custom-select mb-2 mr-sm-4 mb-sm-0"
                  onChange={this.handleDataSourceChange}
                >
                  {dataSourceDropdownOptions}
                </Input>
                {mountedFilesFlag && (
                  <MountedDataFormRow
                    xgSelect={this.state.xgSelect}
                    xgSelectOptions={this.state.xgSelectOptions}
                    gbwtSelect={this.state.gbwtSelect}
                    gbwtSelectOptions={this.state.gbwtSelectOptions}
                    gamSelect={this.state.gamSelect}
                    gamSelectOptions={this.state.gamSelectOptions}
                    pathSelect={this.state.pathSelect}
                    pathSelectOptions={this.state.pathSelectOptions}
                    handleInputChange={this.handleInputChange}
                  />
                )}
                {uploadFilesFlag && (
                  <FileUploadFormRow
                    pathSelect={this.state.pathSelect}
                    pathSelectOptions={this.state.pathSelectOptions}
                    handleInputChange={this.handleInputChange}
                    getPathNames={this.getPathNames}
                    resetPathNames={this.resetPathNames}
                    handleFileUpload={this.handleFileUpload}
                    showFileSizeAlert={this.showFileSizeAlert}
                    setUploadInProgress={this.setUploadInProgress}
                  />
                )}
                {sparqlFlag && (
                  <SparqlDataFormRow
                    sparqlSelect={this.state.sparqlSelect}
                    pathSelect={this.state.pathSelect}
                    getPathNames={this.updatePathNamesFromSparql}
                    pathSelectOptions={this.state.pathSelectOptions}
                    handleInputChange={this.handleInputChange}
                  />
                )}
              </Form>
              <Alert
                color="danger"
                isOpen={this.state.fileSizeAlert}
                toggle={() => {
                  this.setState({ fileSizeAlert: false });
                }}
                className="mt-3"
              >
                <strong>File size too big! </strong>
                You may only upload files with a maximum size of{' '}
                {MAX_UPLOAD_SIZE_DESCRIPTION}.
              </Alert>
              {examplesFlag ? (
                <ExampleSelectButtons
                  setDataOrigin={this.props.setDataOrigin}
                  setColorSetting={this.props.setColorSetting}
                />
              ) : (
                <DataPositionFormRow
                  nodeID={this.state.nodeID}
                  distance={this.state.distance}
                  byNode={this.state.byNode}
                  handleInputChange={this.handleInputChange}
                  handleGoLeft={this.handleGoLeft}
                  handleGoRight={this.handleGoRight}
                  handleGoButton={this.handleGoButton}
                  uploadInProgress={this.state.uploadInProgress}
                />
              )}
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

export default HeaderForm;
