const triggerCrawlNodes = require('./triggerCrawlNodes');
const triggerCrawlRevisions = require('./triggerCrawlRevisions');
const triggerCrawlMetadata = require('./triggerCrawlMetadata');
const fillMissingFileCreated = require('./fillMissingFileCreated');
const createDatasets = require('./createDatasets');
const exportMetadata = require('./exportMetadata');

const ONLY_NODES = process.env.ONLY_NODES && process.env.ONLY_NODES.split(',').map((i) => parseInt(i, 10));

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
    console.log('datasets created')
    await exportMetadata('/data/metadata.json', ONLY_NODES);
    console.log('all done');
  } catch(e) {
   console.log('Unhandled error', e.stack);
  }
}
run();
