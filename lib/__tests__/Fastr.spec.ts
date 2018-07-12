
import * as fs from 'fs'
import Fastr from '../Fastr'

describe('Fastr.ts', () => {

  it('load JSON files and search Fastr index', () => {
    let fastr = new Fastr({ dataDir: './data' })
    expectSearchToWork(fastr)
  })

  it('load from array and search Fastr index', () => {    
    let fastr = new Fastr({ 
      documents: [
        loadVideo('--AguZ20lLA'), 
        loadVideo('595M1X2R80A')
      ] 
    })
    expectSearchToWork(fastr)
  })

  it('load and serialize Fastr index', () => {
    let fastr = new Fastr({ dataDir: './data' })
    expectSearchToWork(fastr)
    fastr.serializeToDir('./serialized')
    fastr = new Fastr({ dataDir: './serialized', serialized: true })
    expectSearchToWork(fastr)
  })

})

function loadVideo(id: string) {
  return JSON.parse(fs.readFileSync(`./data/${id}.json`).toString())
}

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