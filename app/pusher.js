const fs = require('fs');
const Transform = require('stream').Transform;
const stringify = require('csv-stringify');

const createOutputStream = (filename) => {
  const writeStream = fs.createWriteStream(filename);
  const stringifyStream = stringify({ header: true });
  const pusher = new Transform({ objectMode: true })
  pusher.pipe(stringifyStream).pipe(writeStream);
  return pusher;
}
module.exports = createOutputStream;

