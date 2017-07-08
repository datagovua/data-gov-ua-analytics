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


module.exports = function crawlNodes(idArray) {

  let errors = [];
  saver.init();
  return requester.init().then(() => {

    return new Promise((resolve, reject) => {
      function scheduleNext(nodeId) {
        if(!nodeId) {
          saver.finish()
            .then(() => requester.finish())
            .then(() => resolve(errors));
        } else if(visited(nodeId)) {
          process.nextTick(() => scheduleNext(idArray.pop()));
        } else {
          process.nextTick(() => {
            return getNode(nodeId)
              .then(node => saver.save(node))
              .then(() => {
                scheduleNext(idArray.pop());
              })
              .catch(e => {
                errors.push(e);
                scheduleNext(idArray.pop());
              })
          });
        }
      }
      scheduleNext(idArray.pop());
    });

  });

}
