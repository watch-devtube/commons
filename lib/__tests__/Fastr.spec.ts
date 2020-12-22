import * as path from "path";
import * as fs from 'fs'
import Fastr from '../Fastr'
import { Video, Criteria } from '../Fastr'

const indexFile = 'index.json'

describe('Fastr.ts', () => {

  it("finds videos by title match", () => {
    const video1 = loadVideo('-ES1wlV-8lU');
    const video2 = loadVideo('6XdwHo1BWwY');
    const video3 = loadVideo('3DLfkWWw_Tg');

    expect(video1.title).toEqual("Nickolas Means: The Building Built on Stilts")
    expect(video3.title).toEqual("C++: The Open Source Computational Geometry Algorithms Library")

    const documents = [video1, video2, video3]
    const fastr = new Fastr({ documents })
    expect(fastr.search(new Criteria().limitFts('Means'))).toHaveLength(1);
    expect(fastr.search(new Criteria().limitFts('MEANS'))).toHaveLength(1);
    expect(fastr.search(new Criteria().limitFts('Stilts'))).toHaveLength(1);
    expect(fastr.search(new Criteria().limitFts('The Building Built on Stilts'))).toHaveLength(1);
    expect(fastr.search(new Criteria().limitFts('C++'))).toHaveLength(1);
  })

  it("finds videos by speaker's twitter", () => {
    const documents = loadVideos(['--AguZ20lLA', '6XdwHo1BWwY'])
    const fastr = new Fastr({ documents })
    const criteria = new Criteria().limitSpeakers(['eduardsi'])
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit).toEqual("--AguZ20lLA")
    expect(hits).toHaveLength(1)
  })

  it("finds videos by ids", () => {
    const documents = loadVideos(['--AguZ20lLA', '6XdwHo1BWwY'])
    const fastr = new Fastr({ documents })
    const criteria = new Criteria().limitIds(['--AguZ20lLA'])
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit).toEqual("--AguZ20lLA")
    expect(hits).toHaveLength(1)
  })

  it("finds videos by channels", () => {
    const documents = loadVideos(['--AguZ20lLA', '6XdwHo1BWwY'])
    const fastr = new Fastr({ documents })
    const criteria = new Criteria().limitChannels(['Fun Fun Function'])
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit).toEqual("--AguZ20lLA")
    expect(hits).toHaveLength(1)
  })

  it("supports exclusions", () => {
    const documents = loadVideos(['--AguZ20lLA', '6XdwHo1BWwY', '59ck_Z75cEY']);
    const fastr = new Fastr({ documents })
    const criteria = new Criteria().excludeIds(['--AguZ20lLA', '6XdwHo1BWwY']);
    const hits = fastr.search(criteria);
    const [hit] = hits
    expect(hit).toEqual("59ck_Z75cEY")
    expect(hits).toHaveLength(1)
  })

  it('returns all serialized videos default ordered by satisfaction desc', () => {
    const documents = videos(__dirname + '/data');
    new Fastr({ documents }).serializeToFile(indexFile);

    const fastr = new Fastr({ indexFile })

    const criteria = new Criteria();
    const hits = fastr.search(criteria);
    expect(hits[0]).toBe("6BYq6hNhceI")
    expect(hits[1]).toBe("3DLfkWWw_Tg")
    expect(hits[2]).toBe("6C24p0IhvqI")
    expect(hits[60]).toBe("-Ew5zdAnLuw")
    expect(hits).toHaveLength(61)
  })

  it('returns all serialized videos showing newest first', () => {
    const documents = videos(__dirname + '/data');
    new Fastr({ documents }).serializeToFile(indexFile);

    const fastr = new Fastr({ indexFile })

    const criteria = new Criteria();
    const hits = fastr.search(criteria, 'recordingDate');
    expect(hits[0]).toBe("7bYIr8144Ms")
    expect(hits[1]).toBe("1meg-Dl_Urw")
    expect(hits[2]).toBe("4rT0xjmWCCo")
    expect(hits[60]).toBe("6omCljcgvMI")
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