jest.mock('request-promise');
jest.mock('./cache');

const createRequester = require('./requester');
const rp = require('request-promise');

describe('request', () => {
  it('returns text', () => {
    rp.setup((url) => { return { text: 'RESPONSE', code: 200 } });
    const requester = createRequester();
    return requester.init().then(() => {
      return requester.request().then(text => {
        requester.finish();
        rp.unsetup();
        expect(text).toEqual('RESPONSE');
      });
    });
  });

  it('does not retry 404', () => {
    rp.setup((url) => { return { code: 404, text: 'Not Found' } });
    const requester = createRequester();
    return new Promise((resolve, reject) => {
      requester.init().then(() => {
        requester.request().catch(err => {
          try {
            requester.finish();
            rp.unsetup();
            if(!err.statusCode) { throw err; }
            expect(err.statusCode).toEqual(404);
            resolve();
          } catch (err) {
            reject(err);
          }
        }).then(() => reject('should\'ve failed'))
      });
    });
  });
})
