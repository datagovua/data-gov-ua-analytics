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
const createDbReader = require('./dbReader');

let reader;
const ONLY_NODES = process.env.ONLY_NODES && process.env.ONLY_NODES.split(',').map((i) => parseInt(i, 10));

async function readNodes(onlyNodes) {
  reader = createDbReader();
  await reader.init();
  return reader.readNodes(onlyNodes);
}

async function getNodesToFreshen() {
  if (ONLY_NODES) {
    return readNodes(ONLY_NODES);
  } else {
    return readNodes();
  }
}

module.exports = function() {
  return getNodesToFreshen()
  .then(nodesCursor => {
    return nodesCursor.eachAsync((node) => {
      // TODO skip resource nodes with revision (resources don't change)
      return crawlRevisions([node]);
    })
  })
  .then(() => {
    return reader.finish();
  })
}
