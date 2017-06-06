jest.mock('request-promise');
jest.mock('./cache');

const requester = require('./requester');
const rp = require('request-promise');

describe('request', () => {
  it('returns text', () => {
    rp.setup((url) => { return { text: 'RESPONSE', code: 200 } });
    requester.init(0);
    return requester.request().then(text => {
      requester.finish();
      rp.unsetup();
      expect(text).toEqual('RESPONSE');
    })
  });

  it('does not retry 404', () => {
    rp.setup((url) => { return { code: 404, text: 'Not Found' } });
    requester.init(10);
    return new Promise((resolve, reject) => {
      requester.request().catch(err => {
        try {
          requester.finish();
          rp.unsetup();
          expect(err.statusCode).toEqual(404);
          resolve();
        } catch (err) {
          reject(err);
        }
      }).then(() => reject('should\'ve failed'))
    });
  });
})
