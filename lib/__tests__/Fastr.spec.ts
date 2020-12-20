import * as path from "path";
import * as fs from 'fs'
import Fastr from '../Fastr'
import { Video } from '../Fastr'

describe('Fastr.ts', () => {

  it("finds videos if speaker's name is followed by a colon", () => {
    const video = loadVideo('-ES1wlV-8lU')
    expect(video.title).toEqual("Nickolas Means: The Building Built on Stilts")

    const documents = [video]
    const fastr = new Fastr({ documents })
    const results = fastr.searchInLunr('Means', ['title'])
    expect(results).toHaveLength(1);
  })

  it("finds videos with multiple speakers", () => {
    const video = loadVideo('--AguZ20lLA');
    const documents = [video]
    const fastr = new Fastr({ documents })
    let results = fastr.searchInLunr('GraphQL', ['title'])
    expect(results).toHaveLength(1)

    const [firstHit] = results
    expect(firstHit.recordingDate).toEqual(1507536000)
    expect(firstHit.satisfaction).toEqual(85)
    expect(firstHit.objectID).toEqual("--AguZ20lLA")
    expect(firstHit.speaker).toContain("eduardsi")
    expect(firstHit.speaker).toContain("codingandrey")
  })

  it('returns all serialized videos from loki and lunr', () => {
    const documents = videos(__dirname + '/data');
    new Fastr({ documents }).serializeToDir('./serialized')

    const fastr = new Fastr({ dataDir: './serialized' })

    const lokiHits = fastr.searchInLoki({}, ["-featured"])
    expect(lokiHits).toHaveLength(61)

    const lunrHits = fastr.searchInLunr("", ["-featured"])
    expect(lunrHits).toHaveLength(61)
  })

})

function loadVideo(id: string) {
  return JSON.parse(fs.readFileSync(__dirname + `/data/${id}.json`).toString())
}

function videos(dataHome: string): Video[] {
  return walkDirSync(dataHome)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(f).toString()))
}

function walkDirSync(dir: string, fileList: string[] = []): string[] {
  fs.readdirSync(dir).forEach((file) => {
    fileList = fs.statSync(path.join(dir, file)).isDirectory()
      ? walkDirSync(path.join(dir, file), fileList)
      : fileList.concat(path.join(dir, file));
  });
  return fileList;
}