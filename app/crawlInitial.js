const triggerCrawlNodes = require('./triggerCrawlNodes');
const triggerCrawlRevisions = require('./triggerCrawlRevisions');
const triggerCrawlMetadata = require('./triggerCrawlMetadata');
const createDatasets = require('./createDatasets');

triggerCrawlNodes()
.then(() => triggerCrawlRevisions())
.then(() => triggerCrawlMetadata())
.then(() => createDatasets())
.then(() => console.log('all done'))
.catch(e => {
   console.log('Unhandled error', e.stack);
});
