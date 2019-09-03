import React, { Component } from 'react';
import TubeMap from './TubeMap';
import config from '../config.json';
import { Container, Row, Alert } from 'reactstrap';
import * as tubeMap from '../util/tubemap';
import { dataOriginTypes } from '../enums';

const BACKEND_URL = config.BACKEND_URL || `http://${window.location.host}`;

class TubeMapContainer extends Component {
  state = {
    isLoading: true,
    error: null
  };

  componentDidMount() {
    this.getRemoteTubeMapData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.dataOrigin !== prevProps.dataOrigin) {
      this.props.dataOrigin === dataOriginTypes.API
        ? this.getRemoteTubeMapData()
        : this.getExampleData();
    } else if (this.props.fetchParams !== prevProps.fetchParams) {
      this.getRemoteTubeMapData();
    }
  }

  render() {
    const { isLoading, error } = this.state;

    if (error) {
      console.log(error);
      const message = error.message ? error.message : error;
      return (
        <Container>
          <Row>
            <Alert color="danger">{message}</Alert>
          </Row>
        </Container>
      );
    }

    if (isLoading) {
      return (
        <Container>
          <Row>
            <div id="loaderContainer">
              <div id="loader" />
            </div>
          </Row>
        </Container>
      );
    }

    return (
      <div id="tubeMapSVG">
        <TubeMap
          nodes={this.state.nodes}
          tracks={this.state.tracks}
          reads={this.state.reads}
        />
      </div>
    );
  }
  getNodesFromSparql = async () => {
    this.setState({ isLoading: true, error: null });
    const depth="/(f2f:)?";
    var i;
    var depthSp="";
    for (i = 0; i < this.props.fetchParams.distance; i++) { 
       depthSp=depthSp+depth;
    }
    const queryForNodes=`PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns%23> PREFIX vg:<http://biohackathon.org/resource/vg%23> PREFIX f2f:<http://biohackathon.org/resource/vg%23linksForwardToForward> SELECT DISTINCT ?node ?sequence WHERE { BIND (<http://example.org/vg/node/${this.props.fetchParams.nodeId}> AS ?originalNode) . ?originalNode f2f:${depthSp} ?node . ?node rdf:value ?sequence . }`;
    const queryForPaths=`PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns%23> PREFIX vg:<http://biohackathon.org/resource/vg%23> PREFIX f2f:<http://biohackathon.org/resource/vg%23linksForwardToForward> SELECT ?rank ?path ?node WHERE { BIND (<http://example.org/vg/node/${this.props.fetchParams.nodeId}> AS ?originalNode) . ?originalNode f2f:${depthSp} ?node . ?step vg:node ?node ; vg:path ?path ; vg:rank ?rank . } ORDER BY ?rank`;
    try {
      const responseForNodes = await fetch (`http://localhost:8088/sparql/?format=srj&query=${queryForNodes}`);
      const responseForPaths = await fetch (`http://localhost:8088/sparql/?format=srj&query=${queryForPaths}`);
      const jsonNodes = await responseForNodes.json();
      const nodes = jsonNodes.results.bindings.map(o => {const v=o.node.value; return { "id" : v.substr(v.lastIndexOf('/')+1), "sequence" : o.node.sequence.value};});
      console.log(nodes);
      const jsonPaths = await responseForPaths.json();
      console.log(jsonPaths);
      const tracks = new Map();
      jsonPaths.results.bindings.forEach(p => {
            var currentTrack = tracks.get(p.path.value);
            if (currentTrack === undefined) {
                currentTrack = {"id": p.path.value , "sequence": []};
                tracks.put(currentTrack);
            }
            const v=p.node.value;
            const nodeId=v.substr(v.lastIndexOf('/')+1);
            currentTrack.sequence.push(nodeId); 
      });
      const trackArray = Array.from(tracks.values());
      const reads2 = {};
      console.log(trackArray);
      //this.setState({
      //    isLoading: false,
      //    nodes,
       //   trackArray,
       //   reads2
      //  });
    } catch (error) {
        this.setState({ error: error, isLoading: false });
    }
  }

  getRemoteTubeMapData = async () => {
    this.setState({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BACKEND_URL}/getChunkedData`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.props.fetchParams)
      });
      const json = await response.json();
      if (json.graph === undefined) {
        // We did not get back a graph, only (possibly) an error.
        const error = json.error || 'Fetching remote data returned error';
        this.setState({ error: error, isLoading: false });
      } else {
        const nodes = tubeMap.vgExtractNodes(json.graph);
        const tracks = tubeMap.vgExtractTracks(json.graph);
        const reads = tubeMap.vgExtractReads(nodes, tracks, json.gam);
        this.setState({
          isLoading: false,
          nodes,
          tracks,
          reads
        });
      }
    } catch (error) {
      this.setState({ error: error, isLoading: false });
    }
  };

  getExampleData = async () => {
    this.setState({ isLoading: true, error: null });
    let nodes, tracks, reads;
    const data = await import('../util/demo-data');
    nodes = data.inputNodes;
    switch (this.props.dataOrigin) {
      case dataOriginTypes.EXAMPLE_1:
        tracks = data.inputTracks1;
        break;
      case dataOriginTypes.EXAMPLE_2:
        tracks = data.inputTracks2;
        break;
      case dataOriginTypes.EXAMPLE_3:
        tracks = data.inputTracks3;
        break;
      case dataOriginTypes.EXAMPLE_4:
        tracks = data.inputTracks4;
        break;
      case dataOriginTypes.EXAMPLE_5:
        tracks = data.inputTracks5;
        break;
      case dataOriginTypes.EXAMPLE_6:
        const vg = JSON.parse(data.k3138);
        nodes = tubeMap.vgExtractNodes(vg);
        tracks = tubeMap.vgExtractTracks(vg);
        reads = tubeMap.vgExtractReads(
          nodes,
          tracks,
          this.readsFromStringToArray(data.demoReads)
        );
        break;
      default:
        console.log('invalid data origin type');
    }

    this.setState({ isLoading: false, nodes, tracks, reads });
  };

  readsFromStringToArray = readsString => {
    const lines = readsString.split('\n');
    const result = [];
    lines.forEach(line => {
      if (line.length > 0) {
        result.push(JSON.parse(line));
      }
    });
    return result;
  };
}

export default TubeMapContainer;
