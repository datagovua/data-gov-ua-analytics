/**
 * Input:
 * - data/nodes.csv: node_id, canonical, revision_id, dataset_id
 * Output:
 * - data/revisions.csv: revision_id, date, node_id, dataset_id
 */
const cheerio = require('cheerio');
const url = require('url');

const crawlRevisions = require('./crawlRevisions');
const parser = require('./parser');
const reader = require('./reader');

function readNodesFile() {
  return reader('/data/nodes.csv');
}

function getNodesToFreshen() {
  return readNodesFile().then((nodes) => {
    // TODO skip resource nodes with revision (resources don't change)
    return nodes;
  });
}

module.exports = function() {
  return getNodesToFreshen().then(nodes => {
    return crawlRevisions(nodes);
  })
  .then(errors => {
    if(errors.length) {
      console.log("Permanent errors:")
    }
    errors.forEach(function(e) {
      if(e.statusCode !== undefined) {
        console.log(e.path, e.statusCode);
      } else {
        if(e.path) {
          console.log(e.path)
        } else {
          console.log(e);
        }
      }
    });
  })
}
