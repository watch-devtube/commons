import * as fs from "fs";
import * as path from "path";
import * as Lunr from "lunr";
import { Logger } from "./Logger";
import { alwaysArray } from "./Arrays";
import { orderBy } from "lodash";

const DEFAULT_VIDEO_ORDER = 'satisfaction';

export interface FastrOptions {
  dataDir?: string;
  documents?: Video[];
}

export interface Speaker {
  twitter: string;
  name: string;
}

export interface Video {
  objectID: string;
  title: string;
  featured: boolean;
  satisfaction: number;
  creationDate: number;
  recordingDate: number;
  speaker: Speaker | Speaker[];
  channelId: string;
  channelTitle: string;
  language: string;
}

export interface SerializedIndex {
  loki: string;
  lunr: string;
}

interface LokiObject {
  objectID: string;
  channelTitle: string;
  recordingDate: number;
  speakers: string[];
  satisfaction: number;
}

class Loki {

  private _videoIndexById = {};
  private _videos: LokiObject[] = []

  video(id: string): LokiObject {
    const index = this._videoIndexById[id];
    return this._videos[index];
  }

  videos(): LokiObject[] {
    return this._videos;
  }

  private constructor() {
  }

  public static fromVideos(videos: Video[]): Loki {
    const loki = new Loki();
    const videosOrdered = orderBy(videos, [DEFAULT_VIDEO_ORDER], ['desc']);
    loki.pushAll(videosOrdered);
    return loki;
  }

  public static fromJson(json: string): Loki {
    const { _videos, _videoIndexById } = JSON.parse(json);
    const loki = new Loki();
    loki._videos = _videos;
    loki._videoIndexById = _videoIndexById;
    return loki;
  }

  pushAll(videos: Video[]) {
    videos.forEach(video => {
      this._videoIndexById[video.objectID] = this._videos.length;
      this._videos.push(this.toLokiObject(video))
    });
  }

  private toLokiObject({ objectID, channelTitle, recordingDate, satisfaction, speaker }: Video): LokiObject {
    const speakers = alwaysArray(speaker).map(speaker => speaker.twitter);
    const lokiObject = {
      objectID,
      channelTitle,
      recordingDate,
      satisfaction,
      speakers
    } as LokiObject
    return lokiObject;
  };

}

class DataHome {
  constructor(readonly dataDir: string) {
  }

  readFile(name: string) {
    const dataHome = path.resolve(this.dataDir);
    return fs.readFileSync(path.join(path.resolve(dataHome), name))
  }
}

export default class Fastr {
  private readonly loki: Loki;
  private readonly lunr: Lunr.Index;

  constructor(options: FastrOptions) {
    const { dataDir, documents } = options;
    if (!dataDir && !documents) {
      throw { message: "Neither 'dataDir' nor 'documents' parameter are specified!" };
    }

    if (dataDir) {
      const dataHome = new DataHome(dataDir);
      Logger.time(`Loading Loki and Lunr data from ${dataHome}`);
      this.loki = this.loadLokiIndex(dataHome.readFile("loki.json"));
      this.lunr = this.loadLunrIndex(dataHome.readFile("lunr.json"));
      Logger.timeEnd(`Loading Loki and Lunr data from ${dataHome}`);
    } else {
      this.lunr = this.buildLunrIndex(documents);
      this.loki = this.buildLokiIndex(documents);
    }
  }

  private buildLunrIndex(docs: Video[]) {
    Logger.time("Populate Lunr index");

    const builder = new Lunr.Builder();
    builder.pipeline.remove(Lunr.trimmer);
    builder.ref("objectID");
    builder.field("title", {
      extractor: (doc: Video) => doc.title.replace(":", " ").replace("?", ""),
    });
    builder.field("speaker", {
      extractor: (doc: Video) =>
        alwaysArray(doc.speaker)
          .map((it) => it.name)
          .join(" "),
    });
    builder.field("channelTitle");

    Logger.time("Add all documents to Lunr index");
    docs.forEach((video) => builder.add(video));
    Logger.timeEnd("Add all documents to Lunr index");

    Logger.time("Build Lunr index");
    const lunr = builder.build();
    Logger.timeEnd("Build Lunr index");

    Logger.timeEnd("Populate Lunr index");
    return lunr;
  }

  private buildLokiIndex(docs: Video[]) {
    Logger.time("Populate Loki database");
    const loki = Loki.fromVideos(docs);
    Logger.timeEnd("Populate Loki database");
    return loki;
  }

  private loadLokiIndex(serializedIndex: string | Buffer) {
    Logger.time(`Loading Loki data from Buffer`);
    const loki = Loki.fromJson(serializedIndex.toString());
    Logger.timeEnd(`Loading Loki data from Buffer`);
    return loki;
  }

  private loadLunrIndex(serializedIndex: string | Buffer) {
    Logger.time(`Loading Lunr data`);
    const lunr = Lunr.Index.load(JSON.parse(serializedIndex.toString()));
    Logger.timeEnd(`Loading Lunr data`);
    return lunr;
  }

  serialize(): SerializedIndex {
    return {
      loki: JSON.stringify(this.loki),
      lunr: JSON.stringify(this.lunr),
    };
  }

  serializeToDir(dir: string) {
    let index = this.serialize();
    let absDir = path.resolve(dir);
    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir);
    }
    fs.writeFileSync(path.join(absDir, "loki.json"), index.loki);
    fs.writeFileSync(path.join(absDir, "lunr.json"), index.lunr);
  }

  fullTextSearch(query: string, order: keyof LokiObject = DEFAULT_VIDEO_ORDER): LokiObject[] {
    const videos = this.lunr
      .search(query)
      .map(hit => this.loki.video(hit.ref))
    return orderBy(videos, [order], ['desc'])
  }

  search(criteria: Criteria, order: keyof LokiObject = DEFAULT_VIDEO_ORDER): LokiObject[] {
    const videos = this.loki.videos();
    const matchingVideos = videos.filter(video => criteria.isSatisfiedBy(video))
    if (order === DEFAULT_VIDEO_ORDER) {
      return matchingVideos;
    } else {
      return orderBy(matchingVideos, [order], ['desc'])
    }
  }

}

export class Criteria {
  private _query: string;
  private _speakers: string[];
  private _channels: string[];
  private _ids: string[];
  private _noIds: string[];

  limitIds(ids: string[]): Criteria {
    this._ids = ids;
    return this;
  }

  limitSpeakers(speakers: string[]): Criteria {
    this._speakers = speakers;
    return this;
  }

  limitChannels(channels: string[]): Criteria {
    this._channels = channels;
    return this;
  }

  limitFts(query: string): Criteria {
    this._query = query;
    return this;
  }

  isFts(): boolean {
    return !!this._query;
  }

  ftsQuery(): string {
    return this._query;
  }

  excludeIds(ids: string[]): Criteria {
    this._noIds = ids;
    return this;
  }

  isSatisfiedBy(video: LokiObject): boolean {
    const isExcluded = this._noIds && this._noIds.includes(video.objectID);
    if (isExcluded) {
      return false;
    }

    if (this._channels)
      return this._channels.some(it => video.channelTitle === it)
    if (this._speakers)
      return this._speakers.some(it => video.speakers.includes(it))
    if (this._ids)
      return this._ids.some(it => video.objectID === it)

    return true;
  }
}
