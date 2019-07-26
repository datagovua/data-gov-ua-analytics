jest.mock('request-promise');
jest.mock('./cache');

const createRequester = require('./requester');
const rp = require('request-promise');

describe('request', () => {
  it('returns text', async () => {
    rp.setup((url) => { return { text: 'RESPONSE', code: 200 } });

    const requester = createRequester();
    const delayMs = 1;
    await requester.init(delayMs);

    const text = await requester.request('/');
    requester.finish();

    expect(text).toEqual('RESPONSE');

    rp.unsetup();
  });

  it('does not retry 404', () => {
    rp.setup((url) => { return { code: 404, text: 'Not Found' } });
    const requester = createRequester();
    const delayMs = 1;
    return new Promise((resolve, reject) => {
      requester.init(delayMs).then(() => {
        requester.request('/').catch(err => {
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
