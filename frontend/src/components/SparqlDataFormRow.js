import React, { Component } from 'react';
import { Label, Input } from 'reactstrap';

class SparqlDataFormRow extends Component {
  render() {

    const pathDropdownOptions = this.props.pathSelectOptions.map(pathName => {
      return (
        <option value={pathName} key={pathName}>
          {pathName}
        </option>
      );
    });

    return (
      <React.Fragment>
        <Label className="customData tight-label mb-2 mr-sm-2 mb-sm-0 ml-2">
          SPARQL endpoint:
        </Label>
        <Input
          type="text"
          className="custom-input form-control mb-2 mr-sm-4 mb-sm-0"
          id="sparqlSelect"
          value={this.props.sparqlSelect}
          onChange={this.props.handleInputChange}
        >

        </Input>

        <Label
          for="pathName"
          className="customData tight-label mb-2 mr-sm-2 mb-sm-0 ml-2"
        >
          Path name:
        </Label>
        <Input
          type="select"
          className="customData custom-select mb-2 mr-sm-4 mb-sm-0"
          id="pathSelect"
          value={this.props.pathSelect}
          onChange={this.props.handleInputChange}
        >
          {pathDropdownOptions}
        </Input>
      </React.Fragment>
    );
  }
}

export default SparqlDataFormRow;
