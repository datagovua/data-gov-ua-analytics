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
const reader = require('./reader');

function readRevisionsFile() {
  return reader('/data/revisions.csv');
}

function getRevisionsToFetch() {
  return readRevisionsFile().then((revisions) => {
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
  })
  .catch(e => console.error('Failure:', e));
}
