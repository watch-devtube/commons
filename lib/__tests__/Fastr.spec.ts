import * as path from "path";
import * as fs from 'fs'
import Fastr from '../Fastr'
import { Video, Criteria } from '../Fastr'

describe('Fastr.ts', () => {

  it("returns all necessary video information", () => {
    const documents = [loadVideo('--AguZ20lLA')]
    const fastr = new Fastr({ documents })
    const criteria = new Criteria();
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit.recordingDate).toEqual(1507536000)
    expect(hit.satisfaction).toEqual(85)
    expect(hit.objectID).toEqual("--AguZ20lLA")
    expect(hit.speakers).toContain("eduardsi")
    expect(hit.speakers).toContain("codingandrey")
  })

  it("finds videos by query", () => {
    const video = loadVideo('-ES1wlV-8lU')
    const video2 = loadVideo('6XdwHo1BWwY');

    expect(video.title).toEqual("Nickolas Means: The Building Built on Stilts")
    const documents = [video, video2]
    const fastr = new Fastr({ documents })
    const results = fastr.fullTextSearch('Means');
    expect(results).toHaveLength(1);
  })

  it("finds videos by query default ordered by satisfaction desc", () => {
    const documents = videos(__dirname + '/data');
    const dataDir = './serialized';
    new Fastr({ documents }).serializeToDir(dataDir)

    const fastr = new Fastr({ documents })
    const hits = fastr.fullTextSearch('a');
    expect(hits).toHaveLength(6);
    expect(hits[0].satisfaction).toBe(230)
    expect(hits[1].satisfaction).toBe(195)
    expect(hits[2].satisfaction).toBe(100)
    expect(hits[3].satisfaction).toBe(100)
    expect(hits[4].satisfaction).toBe(61)
    expect(hits[5].satisfaction).toBe(0)
  })

  it("finds videos by query showing newest first", () => {
    const documents = videos(__dirname + '/data');
    const dataDir = './serialized';
    new Fastr({ documents }).serializeToDir(dataDir)

    const fastr = new Fastr({ documents })
    const hits = fastr.fullTextSearch('a', 'recordingDate');
    expect(hits).toHaveLength(6);
    expect(hits[0].recordingDate).toBe(1471881367)
    expect(hits[1].recordingDate).toBe(1445972909)
    expect(hits[2].recordingDate).toBe(1358668723)
    expect(hits[3].recordingDate).toBe(1320967112)
    expect(hits[4].recordingDate).toBe(1310034622)
    expect(hits[5].recordingDate).toBe(1264097660)
  })

  it("finds videos by speaker's twitter", () => {
    const documents = loadVideos(['--AguZ20lLA', '6XdwHo1BWwY'])
    const fastr = new Fastr({ documents })
    const criteria = new Criteria().limitSpeakers(['eduardsi'])
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit.objectID).toEqual("--AguZ20lLA")
    expect(hits).toHaveLength(1)
  })

  it("finds videos by ids", () => {
    const documents = loadVideos(['--AguZ20lLA', '6XdwHo1BWwY'])
    const fastr = new Fastr({ documents })
    const criteria = new Criteria().limitIds(['--AguZ20lLA'])
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit.objectID).toEqual("--AguZ20lLA")
    expect(hits).toHaveLength(1)
  })

  it("finds videos by channels", () => {
    const documents = loadVideos(['--AguZ20lLA', '6XdwHo1BWwY'])
    const fastr = new Fastr({ documents })
    const criteria = new Criteria().limitChannels(['Fun Fun Function'])
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit.objectID).toEqual("--AguZ20lLA")
    expect(hits).toHaveLength(1)
  })

  it("supports exclusions", () => {
    const documents = loadVideos(['--AguZ20lLA', '6XdwHo1BWwY', '59ck_Z75cEY']);
    const fastr = new Fastr({ documents })
    const criteria = new Criteria().excludeIds(['--AguZ20lLA', '6XdwHo1BWwY']);
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit.objectID).toEqual("59ck_Z75cEY")
    expect(hits).toHaveLength(1)
  })

  it('returns all serialized videos default ordered by satisfaction desc', () => {
    const documents = videos(__dirname + '/data');
    const dataDir = './serialized';
    new Fastr({ documents }).serializeToDir(dataDir)

    const fastr = new Fastr({ dataDir })

    const criteria = new Criteria();
    const hits = fastr.search(criteria);
    expect(hits[0].satisfaction).toBe(280)
    expect(hits[1].satisfaction).toBe(277)
    expect(hits[2].satisfaction).toBe(230)
    expect(hits[60].satisfaction).toBe(-200)
    expect(hits).toHaveLength(61)
  })

  it('returns all serialized videos showing newest first', () => {
    const documents = videos(__dirname + '/data');
    const dataDir = './serialized';
    new Fastr({ documents }).serializeToDir(dataDir)

    const fastr = new Fastr({ dataDir })

    const criteria = new Criteria();
    const hits = fastr.search(criteria, 'recordingDate');
    expect(hits[0].recordingDate).toBe(1530195276)
    expect(hits[1].recordingDate).toBe(1529329401)
    expect(hits[2].recordingDate).toBe(1527478169)
    expect(hits[60].recordingDate).toBe(1191902130)
    expect(hits).toHaveLength(61)
  })

})

function loadVideos(ids: string[]): Video[] {
  return ids.map(id => loadVideo(id))
}

function loadVideo(id: string): Video {
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