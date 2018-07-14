
import { GoogleBucket } from '../GoogleBucket'

describe('GoogleBucket.ts', () => {

  it('check bucket', async () => {
    let bucket = new GoogleBucket('test')
    await bucket.save('test.json', 'asd')
  })

})