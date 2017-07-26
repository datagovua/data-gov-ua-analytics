const createOutputStream = require('./pusher');
let stream;

module.exports = {
  init(filename) {
    if(filename) {
      stream = createOutputStream(filename);
    } else {
      stream = createOutputStream('/data/nodes.csv');
    }
  },
  save(node) {
    return new Promise(resolve => {stream.pusher.push(node); resolve();});
  },
  finish() {
    return new Promise(resolve => {
      stream.pusher.end();
      stream.onFinish(function () {
        resolve();
      });
    });
  }
};
