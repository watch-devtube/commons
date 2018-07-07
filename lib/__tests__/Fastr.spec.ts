
import * as path from 'path'
import Fastr from '../Fastr'

describe('Fastr.ts', () => {

  it('load and search Fastr index', () => {
    let fastr = new Fastr(path.resolve('./data'), 'db1.json')
    let results = fastr.search('GraphQL', {}, 'title')
    expect(results).toBeTruthy()
    expect(results.length).toBeGreaterThan(0)
    fastr.serialize('fastr.json')
  })

  it('load and serialize Fastr index', () => {
    let fastr = new Fastr(path.resolve('./data'), 'db2.json')
    fastr.serialize('fastr.json')
  })

})