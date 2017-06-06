const createOutputStream = require('./pusher');
let pusher;

module.exports = {
  init() {
    pusher = createOutputStream('/data/nodes.csv');
  },
  save(node) {
    return new Promise(resolve => {pusher.push(node); resolve();});
  },
  finish() {
    return new Promise(resolve => {pusher.end(); resolve();});
  }
};
