const triggerCrawlNodes = require('./triggerCrawlNodes');
const triggerCrawlRevisions = require('./triggerCrawlRevisions');
const triggerCrawlMetadata = require('./triggerCrawlMetadata');
const fillMissingFileCreated = require('./fillMissingFileCreated');
const createDatasets = require('./createDatasets');

async function run() {
  try {
    await triggerCrawlNodes();
    console.log('nodes are fetched')
    await triggerCrawlRevisions();
    console.log('revisions are fetched')
    await triggerCrawlMetadata();
    console.log('metadata are fetched')
    await fillMissingFileCreated();
    console.log('create field is filled')
    await createDatasets();
    console.log('all done');
  } catch(e) {
   console.log('Unhandled error', e.stack);
  }
}
run();
