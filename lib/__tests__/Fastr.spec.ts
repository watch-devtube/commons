
import Fastr from '../Fastr'

import { Logger } from '../Logger'

Logger.enabled = true

describe('Fastr.ts', () => {

  it('load and serialize Fastr index', () => {
    let fastr = new Fastr('./data')
    let results = fastr.search('GraphQL', {}, 'desc', 1, 10, 10)
    Logger.info(results)
    fastr.serialize('fastr.json')
  })

})