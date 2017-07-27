/**
 * Moves cache from node-persit format to RethinkDB
*/
const fs = require('fs');
const path = require('path');
const r = require('rethinkdb');


function getFiles() {
  const cacheLocation = '/data/cache2';
  return new Promise((resolve, reject) => {
    fs.readdir(cacheLocation, function (err, arr) {
      if(err) reject(arr);
      resolve(arr);
    });
  });
};

function pushToDb(conn, page) {
  return r.table('cache').insert({url: page.key, content: page.value }).run(conn);
}

function promiseArrayLoop(arr, itemCb) {
  return arr.reduce(function(promise, item, index, all) {
    return promise.then(function() {
      if(index % 10 === 0) {
        console.log(Math.floor(index / all.length * 100) + '%');
      }
      return itemCb(item);
    });
  }, Promise.resolve());
}

function parseFile(filename) {
  var dir = '/data/cache2';
  var file = path.join(dir, filename);

  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function (err, text) {
      if (err) {
        reject(err);
      }
      var input = JSON.parse(text);
      resolve(input);
    });
  })
}

function convertFile(filename, db) {
  return parseFile(filename).then((cacheItem) => {
    return pushToDb(db, cacheItem);
  });
}

function convertLoop(db) {
  return getFiles()
  .then((files) => promiseArrayLoop(files, (filename) => convertFile(filename, db)))
  .then(() => db);
}

function createTable(connection, tableName, primaryKey) {
  return r
    .tableCreate(tableName, { primaryKey: primaryKey })
    .run(connection)
    .catch(err => {
      if(!err.message.match('Table `mirror.' + tableName + '` already exists')) {
        throw err;
      }
    })
}

function prepareDb() {
  return r.connect({
    host: 'rethinkdb',
    port: 28015,
  })
  .then((conn) => {
    return r
    .dbCreate('mirror')
    .run(conn)
    .catch((err) => console.log('ignore db create error'))
    .then(() => conn)
  })
  .then(conn => { conn.use('mirror'); return conn; })
  .then(conn => { createTable(conn, 'cache', 'url'); return conn; })
}


prepareDb().then((db) => convertLoop(db)).then(db => db.close());
