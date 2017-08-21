const r = require('rethinkdb');

module.exports = function() {
  let connection = null;
  const dbName = 'mirror';

  return {
    init() {
      return r
      .connect({host: 'rethinkdb', port: 28015})
      .then((conn) => {
         connection = conn;
         connection.use(dbName);
       });
    },

    readNodes() {
      return r.table('nodes').orderBy('node_id', {index: 'node_id'}).run(connection);
    },

    readTempRevisions() {
      return r.table('temp_revisions').orderBy({index: 'revision_id'}).run(connection);
    },

    readRevisions() {
      return r.table('revisions').orderBy({index: 'revision_id'}).run(connection);
    },

    finish() {
      return connection.close().then(() => { connection = null; });
    },
  }
};
