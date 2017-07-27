const mkdirp = require('mkdirp');
const r = require('rethinkdb');

class Cache {
  constructor() {
  }

  init() {
    return this.prepareDb().then(conn => { this.conn = conn; });
  }

  save(url, content) {
    return r.table('cache').insert({ url, content }, { conflict: 'update'}).run(this.conn);
  }

  retrieve(url) {
    if(!this.conn) throw 'no connection';
    return r.table('cache').get(url).run(this.conn).then(res => res && res.content);
  }

  finish() {
    return this.conn.close();
  }

  prepareDb() {
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
    .then(conn => { return this.createTable(conn, 'cache', 'url').then(() => conn) })
  }

  createTable(connection, tableName, primaryKey) {
    return r
      .tableCreate(tableName, { primaryKey: primaryKey })
      .run(connection)
      .catch(err => {
        if(!err.message.match('Table `mirror.' + tableName + '` already exists')) {
          throw err;
        }
      })
  }


}

module.exports = Cache;
