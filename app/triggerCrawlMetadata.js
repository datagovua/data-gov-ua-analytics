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
const createDbSaver = require('./dbSaver');

const ONLY_NODES = process.env.ONLY_NODES && process.env.ONLY_NODES.split(',').map((i) => parseInt(i, 10));

module.exports = async function() {
  let reader;
  let saver;

  saver = createDbSaver();
  await saver.init();

  reader = createDbReader();
  await reader.init();

  const revisionsCursor = await reader.readTempRevisions(ONLY_NODES);

  await revisionsCursor.eachAsync(async (revision) => {
    // skip revisions without dataset_id
    if(!revision.dataset_id) {
      return;
    }
    const errors = await crawlMetadata([revision]);
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
  await reader.finish();
  await saver.finish();
}
