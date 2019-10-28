import React, { Component } from 'react';
import TubeMap from './TubeMap';
import config from '../config.json';
import { Container, Row, Alert } from 'reactstrap';
import * as tubeMap from '../util/tubemap';
import { dataOriginTypes } from '../enums';
// import DRB1 from '../odgi_data/DRB1-3123.og.bin10.json';
// import yeast from '../odgi_data/recent-yeast.json';
// import sixref from '../odgi_data/sixref_Chr4.og.1000.tile.json'
import sixref from '../odgi_data/sebastian.all.50000.og.10000.tile.json'

let DRB1 = {};
// let sixref = {};
let yeast = {};
const BACKEND_URL = config.BACKEND_URL || `http://${window.location.host}`;

class TubeMapContainer extends Component {
  state = {
    isLoading: true,
    error: null
  };

  componentDidMount() {
    // this.getRemoteTubeMapData();
    this.getExampleData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.dataOrigin !== prevProps.dataOrigin || this.props.fetchParams !== prevProps.fetchParams) {
      if (this.props.dataOrigin === dataOriginTypes.API) {
        this.getRemoteTubeMapData();
      } else if (this.props.dataOrigin === dataOriginTypes.SPARQL) {
        this.getRemoteSparqlData();
      } else {
        this.getExampleData();
      }
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

  runSparqlQueries = async(queryForNodes, queryForPaths) => {
  const sparqlAcceptHeader = {
    'Accept': 'application/sparql-results+json'
  };
    try {
      const responseForNodes = await fetch (`${this.props.fetchParams.sparqlSelect}?query=${queryForNodes}`, {headers: sparqlAcceptHeader });
      const responseForPaths = await fetch (`${this.props.fetchParams.sparqlSelect}?query=${queryForPaths}`, {headers: sparqlAcceptHeader });
      const jsonNodes = await responseForNodes.json();
      const nodes = jsonNodes.results.bindings.map(o => {const v=o.node.value; return { "name" : v.substr(v.lastIndexOf('/')+1), "seq" : o.sequence.value, "sequenceLength" : o.sequence.value.length };});
      const jsonPaths = await responseForPaths.json();
      const tracks = new Map();
      jsonPaths.results.bindings.forEach(p => {
            var currentTrack = tracks.get(p.path.value);
            if (currentTrack === undefined) {
                currentTrack = {"id": tracks.size+1 , "sequence": []};
                if (tracks.size === 0 ) {
                    currentTrack.indexOfFirstBase=1;
                }
                tracks.set(p.path.value, currentTrack);
            }
            const v=p.node.value;
            const nodeId=v.substr(v.lastIndexOf('/')+1);
            currentTrack.sequence.push(nodeId);
      });
      const trackArray = Array.from(tracks.values());
      const reads2 = { "tracks" : []};
      return { "tracks" : trackArray , "nodes" : nodes, "reads" : reads2};
    } catch (error) {
        console.log(error);
        //this.setState({ error: error, isLoading: false });
        throw error;
    }
  };

  getDataFromSparqlByNodes = async () => {
    const depth="/(f2f:)?";
    var i;
    var depthSp="";
    for (i = 0; i < this.props.fetchParams.distance; i++) {
       depthSp=depthSp+depth;
    }
    const queryForNodes=`PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns%23> PREFIX vg:<http://biohackathon.org/resource/vg%23> PREFIX f2f:<http://biohackathon.org/resource/vg%23linksForwardToForward> SELECT DISTINCT ?node ?sequence WHERE { BIND (<http://example.org/vg/node/${this.props.fetchParams.nodeID}> AS ?originalNode) . ?originalNode f2f:${depthSp} ?node . ?node rdf:value ?sequence . }`;
    const queryForPaths=`PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns%23> PREFIX vg:<http://biohackathon.org/resource/vg%23> PREFIX f2f:<http://biohackathon.org/resource/vg%23linksForwardToForward> SELECT DISTINCT ?rank ?path ?node ?position WHERE { BIND (<http://example.org/vg/node/${this.props.fetchParams.nodeID}> AS ?originalNode) . ?originalNode f2f:${depthSp} ?node . ?step vg:node ?node ; vg:path ?path ; vg:rank ?rank ; vg:position ?position . } ORDER BY ?rank`;
    return this.runSparqlQueries(queryForNodes, queryForPaths);
  }

  getDataFromSparqlByNucleotideOffset = async () => {
    const path = this.props.fetchParams.anchorTrackName;
    const distance = this.props.fetchParams.distance;
    const offset = this.props.fetchParams.nodeID;
    const upto = Number(offset) + Number(distance);
    const queryForNodes = `PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns%23> PREFIX vg:<http://biohackathon.org/resource/vg%23> SELECT DISTINCT ?node ?sequence 
WHERE {
  {
  	SELECT ?otherpath (MIN(?otherposition) AS ?moreoffset) WHERE { ?step vg:node ?sharednode ; vg:position ?position ;
            vg:path <${path}> .
      ?step2 vg:node ?sharednode ;
            vg:position ?otherposition ;
            vg:path ?otherpath .
      FILTER(!sameTerm(?otherpath, <${path}>))
      ?node rdf:value ?sequence .
      FILTER(?position >= ${offset} %26%26 ?position <= (${upto}))
    } GROUP BY ?otherpath
  }
  ?step3 vg:node ?node ;
          vg:position ?position3 ;
          vg:path ?otherpath .
  ?node rdf:value ?sequence . FILTER(?position3 >= ?moreoffset %26%26 ?position3 <= ?moreoffset %2B ${distance})}`;
    const queryForPaths = `PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns%23> PREFIX vg:<http://biohackathon.org/resource/vg%23> SELECT DISTINCT ?rank ?path ?node ?position WHERE {
  {
    SELECT ?path (MIN(?otherposition) AS ?moreoffset) WHERE { ?step vg:node ?sharednode ; vg:position ?position2 ;
            vg:path <${path}> .
      ?step2 vg:node ?sharednode ;
            vg:position ?otherposition ;
            vg:path ?path .
      FILTER(!sameTerm(?path, <${path}>))
      ?node rdf:value ?sequence .
      FILTER(?position2 >= ${offset} %26%26 ?position2 <= (${upto}))
    } GROUP BY ?path
  }
  ?step3 vg:node ?node ;
          vg:position ?position ;
          vg:rank ?rank ;
          vg:path ?path .
   FILTER(?position >= ?moreoffset %26%26 ?position <= ?moreoffset %2B ${distance})}`
    return this.runSparqlQueries(queryForNodes, queryForPaths);
  }
  getRemoteSparqlData = async () => {
    this.setState({ isLoading: true, error: null });
    try {
        if (this.props.fetchParams.byNode === 'true'){
            const fetchedData = await this.getDataFromSparqlByNodes();
            this.setState({ isLoading: false, nodes: fetchedData.nodes, tracks: fetchedData.tracks, reads: [] });
        } else {
            const fetchedData = await this.getDataFromSparqlByNucleotideOffset();
            this.setState({ isLoading: false, nodes: fetchedData.nodes, tracks: fetchedData.tracks, reads: [] });

        }
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
    let  tracks, reads;
    const data = await import('../util/demo-data');
    var nodes = data.inputNodes;
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
        const vg = JSON.parse(data.vg_tiny);
        nodes = tubeMap.vgExtractNodes(vg);
        tracks = tubeMap.vgExtractTracks(vg);
        reads = [];
/*        reads = tubeMap.vgExtractReads(
          nodes,
          tracks,
          this.readsFromStringToArray(data.demoReads)
        );*/
        break;
      case dataOriginTypes.DRB1:
        nodes = DRB1.nodes;
        tracks = DRB1.tracks;
        reads = DRB1.reads;
        break;
      case dataOriginTypes.yeast:
        nodes = yeast.nodes;
        tracks = yeast.tracks;
        reads = yeast.reads;
        break;
      case dataOriginTypes.sixref:
        nodes = sixref.nodes;
        tracks = sixref.tracks;
        reads = sixref.reads;
        break;
      case dataOriginTypes.SPARQL:
        this.props.fetchParams.nodeID=2600;
        this.props.fetchParams.distance=10;
        const data2= await this.getDataFromSparqlByNodes();
        nodes = data2.nodes;
        tracks = data2.tracks;
        console.log(data2);
        console.log(nodes);
        //reads = data.reads;
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
