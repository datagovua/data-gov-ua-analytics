/**
 * Input:
 * - data/revisions.csv: revision_id, data, node_id, dataset_id
 * Output:
 * - data/metadata.csv: revision_id, date, node_id, dataset_id
 */
const cheerio = require('cheerio');
const url = require('url');

const crawlMetadata = require('./crawlMetadata');
const parser = require('./parser');
const createDbReader = require('./dbReader');

let reader;

function readRevisions() {
  reader = createDbReader();
  return reader.init().then(() => reader.readTempRevisions());
}

function getRevisionsToFetch() {
  return readRevisions().then((revisions) => {
    return revisions.filter(revision => !!revision.dataset_id);
  });
}

module.exports = function() {
  return getRevisionsToFetch().then(revisions => {
    return crawlMetadata(revisions);
  })
  .then(errors => {
    if(errors.length) {
      console.log("Permanent errors:")
    }
    errors.forEach(function(e) {
      if(e.statusCode !== undefined) {
        console.log(e.path, e.statusCode);
      } else {
        console.log(e);
      }
    });
    return reader.finish();
  })
}
