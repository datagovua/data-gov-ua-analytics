const triggerCrawlNodes = require('./triggerCrawlNodes');
const triggerCrawlRevisions = require('./triggerCrawlRevisions');
const triggerCrawlMetadata = require('./triggerCrawlMetadata');

triggerCrawlNodes()
.then(() => triggerCrawlRevisions())
.then(() => triggerCrawlMetadata())
.then(() => console.log('all done'))
.catch(e => {
   console.log('Unhandled error', e.stack);
});
