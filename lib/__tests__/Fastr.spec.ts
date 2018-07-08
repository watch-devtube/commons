
import * as path from 'path'
import Fastr from '../Fastr'

describe('Fastr.ts', () => {

  it('load and search Fastr index', () => {
    let fastr = new Fastr(path.resolve('./data'))
    expectSearchToWork(fastr)
  })

  it('load and serialize Fastr index', () => {
    let fastr = new Fastr(path.resolve('./data'))
    expectSearchToWork(fastr)
    fastr.serialize('./serialized')
    fastr = new Fastr('./serialized', true)
    expectSearchToWork(fastr)
  })

})

function expectSearchToWork(fastr: Fastr) {
  let results = fastr.search('GraphQL', {}, 'title')
  expect(results).toBeTruthy()
  expect(results.length).toBeGreaterThan(0)
  let tags = fastr.searchTags()
  expect(tags).toBeTruthy()
  expect(tags.length).toBeGreaterThan(0)
  let speakers = fastr.searchSpeakers()
  expect(speakers).toBeTruthy()
  expect(speakers.length).toBeGreaterThan(0)
  let channels = fastr.searchChannels()
  expect(channels).toBeTruthy()
  expect(channels.length).toBeGreaterThan(0)

}