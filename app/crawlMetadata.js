/**
 * Input: node: node_id, revision_id, dataset_id
 * Output: revisions in rethink db database
 */
const cheerio = require('cheerio');
const Promise = require('bluebird');

const createRequester = require('./requester');
const parser = require('./parser');
const createSaver = require('./dbSaver');

const requester = createRequester();

function visited(node) {
  return false;
}

function fetchMetadata(dataset_id, revision_id) {
  return requester.request(`/view-dataset/dataset.json?dataset-id=${dataset_id}&revision-id=${revision_id}`)
  .then(res => JSON.parse(res));
}

function getMetadata(revision) {
  return fetchMetadata(revision.dataset_id, revision.revision_id)
  .then((metadata) => {
    let revisions = metadata.revisions;
    metadata.dataset_node_id = revision.node_id;
    delete metadata.revisions;
    return { metadata, revisions };
  });
}

module.exports = function crawlMetadata(itemArray) {
  let errors = [];
  const databaseSaver = new createSaver();

  return databaseSaver.init().then(() => requester.init()).then(() => {
    return new Promise((resolve, reject) => {
      function scheduleNext(itemArray) {
        let item = itemArray.shift();
        if(!item) {
          databaseSaver.finish()
            .then(() => requester.finish())
            .then(() => resolve(errors));
        } else if(visited(item)) {
          process.nextTick(() => scheduleNext(itemArray));
        } else {
          process.nextTick(() => {
            return getMetadata(item)
              .then(metadata => {
                return databaseSaver.saveRevisions(metadata);
              })
              .then(() => {
                scheduleNext(itemArray);
              })
              .catch(e => {
                errors.push(e);
                scheduleNext(itemArray);
              })
          });
        }
      }
      scheduleNext(itemArray);
    }).catch((err) => {
      databaseSaver.finish().then(() => {
        throw err;
      });
    });
  });
}
