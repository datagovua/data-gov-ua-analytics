/**
 * Input:
 * - temp_revisions table: revision_id, data, node_id, dataset_id
 * Output:
 * - revisions, files tables
 */
const createDbReader = require('./dbReader');
const createSaver = require('./dbSaver');


function createDataset(tempRevision, revision, saver) {
  console.log('processing revision ' + revision.revision_id);
  if(revision.revision_created) {
    revision.dataset_updated = revision.revision_created;
  } else {
    revision.dataset_updated = tempRevision.date;
  }
  delete revision.revision_created;
  delete revision.revision_id;
  return saver.saveDataset(revision);
}


function createDatasets() {
  let reader;
  const databaseSaver = new createSaver();

  function readRevisions() {
    reader = createDbReader();
    return reader.init().then(() => reader.readRevisions());
  }

  return databaseSaver.init()
    .then(() => readRevisions())
    .then(revisionsCursor => {
      return revisionsCursor.eachAsync((revision) => {
        return reader.getTempRevision(revision.revision_id)
        .then((tempRevision) => {
          // skip revisions without dataset_id
          if(!revision.dataset_id) {
            return;
          }
          return createDataset(
            tempRevision,
            revision,
            databaseSaver
          ).then(() => undefined);
        });
      });
    })
    .then(() => {
      return reader.finish().then(() => databaseSaver.finish());
    });
}

module.exports = createDatasets;
