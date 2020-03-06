
import * as fs from 'fs'
import Fastr from '../Fastr'

describe('Fastr.ts', () => {

  it('finds speakers if a name is followed by colon', () => {
    const fastr = new Fastr({ dataDir: './data', buildOnly: "lunr" })
    const results = fastr.search('Means', {}, ['title'])
    expect(results).toBeTruthy()
    expect(results.length).toBeGreaterThan(0)
  })

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

  it('build partial Fastr index', () => {
    
    let fastr = new Fastr({ dataDir: './data', buildOnly: "loki" })

    // Lunr search does NOT work
    let results = fastr.search('GraphQL', {}, ['title'])    
    expect(results).toBeTruthy()
    expect(results.length).toEqual(0)
    
    // Loki search works
    let channels = fastr.listChannels()
    expect(channels).toBeTruthy()
    expect(channels.length).toBeGreaterThan(0)

    let serialized = fastr.serialize()
    expect(serialized).toBeTruthy()
    expect(serialized.lunr.length).toBeLessThan(150) // empty
    expect(serialized.loki.length).toBeGreaterThan(3150) // non-empty

    fastr = new Fastr({ dataDir: './data', buildOnly: "lunr" })

    // Lunr search works
    results = fastr.search('GraphQL', {}, ['title'])
    expect(results).toBeTruthy()
    expect(results.length).toBeGreaterThan(0)

    // Loki search does NOT work
    channels = fastr.listChannels()
    expect(channels).toBeTruthy()
    expect(channels.length).toEqual(0)

    serialized = fastr.serialize()
    expect(serialized).toBeTruthy()
    expect(serialized.lunr.length).toBeGreaterThan(150) // non-empty
    expect(serialized.loki.length).toBeLessThan(3150) // empty

  })

  it('load JSON files, reload JSON files and search Fastr index', () => {
    let fastr = new Fastr({ dataDir: './data' })
    fastr.reload({ dataDir: './data' })
    expectSearchToWork(fastr)
    fastr.reload({ 
      documents: [
        loadVideo('--AguZ20lLA'), 
        loadVideo('595M1X2R80A')
      ] 
    })
    expectSearchToWork(fastr)
  })

})

function loadVideo(id: string) {
  return JSON.parse(fs.readFileSync(`./data/${id}.json`).toString())
}

function expectSearchToWork(fastr: Fastr) {
  let results = fastr.search('GraphQL', {}, ['title'])
  expect(results).toBeTruthy()
  expect(results.length).toBeGreaterThan(0)
  let tags = fastr.listTags()
  expect(tags).toBeTruthy()
  expect(tags.length).toBeGreaterThan(0)
  tags.forEach(tag => {
    expect(tag.videos.total).toBeGreaterThan(0)
  })
  let speakers = fastr.listSpeakers()
  expect(speakers).toBeTruthy()
  expect(speakers.length).toBeGreaterThan(0)
  speakers.forEach(speaker => {
    expect(speaker.videos.total).toBeGreaterThan(0)
  })
  let channels = fastr.listChannels()
  expect(channels).toBeTruthy()
  expect(channels.length).toBeGreaterThan(0)
  channels.forEach(channel => {
    expect(channel.videos.total).toBeGreaterThan(0)
  })
}
