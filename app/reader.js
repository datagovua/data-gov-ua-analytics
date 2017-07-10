const fs = require('fs');
const parse = require('csv-parse');

module.exports = function(filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, text) => {
      parse(text, {columns: true}, function(err, output) {
        if(err) {
          reject(err);
        } else {
          resolve(output);
        }
      });
    })
  });
};
