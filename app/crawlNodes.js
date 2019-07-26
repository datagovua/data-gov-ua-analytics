/**
 * Input: [nodeId]
 * Output: nodes rethinkdb table: (node_id, canonical, revision_id, dataset_id)
 */
const cheerio = require('cheerio');
const Promise = require('bluebird')

const createRequester = require('./requester');
const parser = require('./parser');

const requester = createRequester();

let saver;

function visited(nodeId) {
  return false;
}


function getNode(nodeId) {
  return requester.request(`/node/${nodeId}`)
    .then(res => cheerio.load(res))
    .then(dom => ({
      node_id: parser.parseNodeId(dom),
      canonical: parser.parseCanonical(dom),
      revision_id: parser.parseRevisionId(dom),
      dataset_id: parser.parseDatasetId(dom),
      file_url: parser.parseResourceUrl(dom),
    }));
}

function delay(timeout) {
  return new Promise(function (resolve) {
    setTimeout(resolve, timeout);
  });
}

function scheduleNext(nodeId, idArray, errors, resolve, reject) {
  delay(1).then(() => {
    if(!nodeId) { // if nodeId is null then idArray is empty
      saver.finish()
        .then(() => requester.finish())
        .then(() => resolve(errors));
    } else if(visited(nodeId)) {
      process.nextTick(() => scheduleNext(idArray.pop(), idArray, errors, resolve, reject));
    } else {
      process.nextTick(() => {
        getNode(nodeId)
          .then(node => { return saver.saveNode(node); })
          .then(() => {
            scheduleNext(idArray.pop(), idArray, errors, resolve, reject);
          })
          .catch(e => {
            errors.push(e);
            scheduleNext(idArray.pop(), idArray, errors, resolve, reject);
          });
      });
    }
  });
}

module.exports = function crawlNodes(outputSaver, idArray) {
  let errors = [];
  saver = outputSaver;
  return saver.init()
  .then(() => requester.init())
  .then(() => {
    return new Promise((resolve, reject) => {
      scheduleNext(idArray.pop(), idArray, errors, resolve, reject);
    });
  });
}
