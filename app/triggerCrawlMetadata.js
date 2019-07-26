/**
 * Input:
 * - temp_revisions table: revision_id, data, node_id, dataset_id
 * Output:
 * - revisions, files tables
 */
const cheerio = require('cheerio');
const url = require('url');

const crawlMetadata = require('./crawlMetadata');
const parser = require('./parser');
const createDbReader = require('./dbReader');

const ONLY_NODES = process.env.ONLY_NODES && process.env.ONLY_NODES.split(',').map((i) => parseInt(i, 10));

module.exports = function() {
  let reader;

  function readRevisions() {
    reader = createDbReader();
    return reader.init().then(() => reader.readTempRevisions(ONLY_NODES));
  }

  return readRevisions()
  .then(revisionsCursor => {
    return revisionsCursor.eachAsync((revision) => {
      // skip revisions without dataset_id
      if(!revision.dataset_id) {
        return;
      }
      return crawlMetadata([revision]).then(errors => {
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
      });
    })
  })
  .then(() => {
    return reader.finish();
  });
}
