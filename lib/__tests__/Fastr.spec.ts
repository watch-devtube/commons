
import * as fs from 'fs'
import Fastr from '../Fastr'

describe('Fastr.ts', () => {

  it('finds speakers if a name is followed by colon', () => {
    const fastr = new Fastr({ dataDir: './data', buildOnly: "lunr" })
    const results = fastr.searchInLunr('Means', ['title'])
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

    let results = fastr.searchInLunr('GraphQL', ['title'])
    expect(results).toBeTruthy()
    expect(results.length).toEqual(0)

    let serialized = fastr.serialize()
    expect(serialized).toBeTruthy()
    expect(serialized.lunr.length).toBeLessThan(150) // empty
    expect(serialized.loki.length).toBeGreaterThan(3150) // non-empty

    fastr = new Fastr({ dataDir: './data', buildOnly: "lunr" })

    results = fastr.searchInLunr('GraphQL', ['title'])
    expect(results).toBeTruthy()
    expect(results.length).toBeGreaterThan(0)

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
  let results = fastr.searchInLunr('GraphQL', ['title'])
  expect(results).toBeTruthy()
  expect(results.length).toBeGreaterThan(0)

  const [firstHit] = results
  expect(firstHit.speaker).toContain("eduardsi")
  expect(firstHit.speaker).toContain("codingandrey")
}
