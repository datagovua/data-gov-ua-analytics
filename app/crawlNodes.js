/**
 * Input: nodeId
 * Output: nodes.csv: (node_id, canonical, revision_id, dataset_id)
 */
const cheerio = require('cheerio');
const Promise = require('bluebird')

const createRequester = require('./requester');
const saver = require('./saver');
const parser = require('./parser');

const requester = createRequester();

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
    }));
}

function delay(timeout) {
  return new Promise(function (resolve) {
    setTimeout(resolve, timeout);
  });
}

function scheduleNext(nodeId, idArray, errors, resolve, reject) {
  delay(1).then(() => {
    if(!nodeId) {
      saver.finish()
        .then(() => requester.finish())
        .then(() => resolve(errors));
    } else if(visited(nodeId)) {
      process.nextTick(() => scheduleNext(idArray.pop(), idArray, errors, resolve, reject));
    } else {
      process.nextTick(() => {
        getNode(nodeId)
          .then(node => saver.save(node))
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

module.exports = function crawlNodes(idArray) {

  let errors = [];
  saver.init();
  return requester.init().then(() => {

    return new Promise((resolve, reject) => {
      scheduleNext(idArray.pop(), idArray, errors, resolve, reject);
    });

  });

}
