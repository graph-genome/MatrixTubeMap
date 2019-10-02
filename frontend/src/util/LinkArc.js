import * as d3 from 'd3';

export class LinkArc {
  constructor(x1, x2){
    this.left = x1;
    this.right = x2;
  }

  fromString(Lstring){
    return new LinkArc(Lstring.split(',')[0], Lstring.split(',')[1]);
  }

  toString(){
    return this.left + ',' + this.right;
  }
}

// prepare a helper function
var curveFunc = d3.line()
  .curve(d3.curveBasis)              // This is where you define the type of curve. Try curveStep for instance.
  .x(function(d) { return d.x })
  .y(function(d) { return d.y });

export function drawArc(x1, x2, y, nodeY, seq, end, svg){
  var bottom = 34;
  var points = [{x: x1, y: bottom}, {x: (x1+end)/2, y: -15}, {x: end, y: bottom}];

  // Add the path using this helper function
  return svg.append('path')
    .attr('d', curveFunc(points))
    .attr('stroke', 'black')
    .attr('stroke-width', 1)
    .attr('fill', 'none')
    .attr('query', end)
    .attr('x1', x1);
}
