import * as fs from "fs";
import * as path from "path";

import { Logger } from "./Logger";
import { alwaysArray } from "./Arrays";
import { orderBy } from "lodash";

export interface FastrOptions {
  indexFile?: string;
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

interface IndexedVideo {
  objectID: string;
  channelTitle: string;
  recordingDate: number;
  speakerTwt: string[];
  speakerNames: string[];
  satisfaction: number;
  title: string
}

type Order = 'satisfaction' | 'recordingDate'
type Index = '_videoIdsBySatisfaction' | '_videoIdsByNew'

const indices = new Map<Order, Index>()
indices.set('satisfaction', '_videoIdsBySatisfaction')
indices.set('recordingDate', '_videoIdsByNew')

class FastIndex {

  private _videos = {}
  private _videoIdsByNew = []
  private _videoIdsBySatisfaction = []

  videos(order: Order): IndexedVideo[] {
    const index = indices.get(order);
    return this[index].map(objectID => this._videos[objectID]);
  }

  private constructor() {
  }

  public static fromVideos(videos: Video[]): FastIndex {
    const index = new FastIndex();
    index.pushAll(videos);
    return index;
  }

  public static fromJson(json: string): FastIndex {
    const { _videos, _videoIdsByNew, _videoIdsBySatisfaction } = JSON.parse(json);
    const index = new FastIndex();
    index._videos = _videos;
    index._videoIdsByNew = _videoIdsByNew;
    index._videoIdsBySatisfaction = _videoIdsBySatisfaction;
    return index;
  }

  pushAll(videos: Video[]) {
    videos.forEach(video => {
      this._videos[video.objectID] = this.toIndexedVideo(video);
    });

    orderBy(videos, ["satisfaction"], ['desc'])
      .forEach(({ objectID }) => this._videoIdsBySatisfaction.push(objectID))

    orderBy(videos, ["recordingDate"], ['desc'])
      .forEach(({ objectID }) => this._videoIdsByNew.push(objectID))

  }

  private toIndexedVideo({ objectID, title, channelTitle, recordingDate, satisfaction, speaker }: Video): IndexedVideo {
    const speakerTwt = alwaysArray(speaker).map(speaker => speaker.twitter);
    const speakerNames = alwaysArray(speaker).map(speaker => speaker.name);
    const indexedVideo = {
      objectID,
      title,
      channelTitle,
      recordingDate,
      satisfaction,
      speakerNames,
      speakerTwt
    } as IndexedVideo
    return indexedVideo;
  };

}

class IndexFile {
  constructor(readonly indexFile: string) {
  }

  read() {
    const cwd = process.cwd();
    const dataDir = path.resolve(cwd, "data")
    const dataHome = path.resolve(dataDir);
    return fs.readFileSync(path.join(path.resolve(dataHome), this.indexFile))
  }
}

export default class Fastr {
  private readonly index: FastIndex;

  constructor(options: FastrOptions) {
    const { indexFile, documents } = options;
    if (!indexFile && !documents) {
      throw { message: "Neither 'indexFile' nor 'documents' parameter are specified!" };
    }

    if (indexFile) {
      Logger.time(`Loading Loki and Lunr data from ${indexFile}`);
      this.index = this.loadIndex(new IndexFile(indexFile).read());
      Logger.timeEnd(`Loading Loki and Lunr data from ${indexFile}`);
    } else {
      this.index = this.buildIndex(documents);
    }
  }

  private buildIndex(docs: Video[]) {
    Logger.time("Populate Loki database");
    const index = FastIndex.fromVideos(docs);
    Logger.timeEnd("Populate Loki database");
    return index;
  }

  private loadIndex(serializedIndex: string | Buffer) {
    Logger.time(`Loading Loki data from Buffer`);
    const index = FastIndex.fromJson(serializedIndex.toString());
    Logger.timeEnd(`Loading Loki data from Buffer`);
    return index;
  }

  serialize(): string {
    return JSON.stringify(this.index)
  }

  serializeToFile(indexFile: string) {
    const index = this.serialize();
    const absDir = path.resolve("data");
    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir);
    }
    fs.writeFileSync(path.join(absDir, indexFile), index);
  }

  search(criteria: Criteria, order: Order = "satisfaction"): string[] {
    const videos = this.index.videos(order);
    const matchingVideos = videos.filter(video => criteria.isSatisfiedBy(video))
    return matchingVideos.map(({ objectID }) => objectID);
  }

}

export class Criteria {
  private _query?: string;
  private _speakers?: string[];
  private _channels?: string[];
  private _ids?: string[];
  private _noIds?: string[];

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

  excludeIds(ids: string[]): Criteria {
    this._noIds = ids;
    return this;
  }

  isSatisfiedBy(video: IndexedVideo): boolean {
    const isExcluded = this._noIds && this._noIds.includes(video.objectID);
    if (isExcluded) {
      return false;
    }

    if (this._query) {
      return video.title.includes(this._query) ||
        video.channelTitle.includes(this._query) ||
        video.speakerNames.some(name => name.includes(this._query))
    }

    if (this._channels)
      return this._channels.some(it => video.channelTitle === it)
    if (this._speakers)
      return this._speakers.some(it => video.speakerTwt.includes(it))
    if (this._ids)
      return this._ids.some(it => video.objectID === it)

    return true;
  }
}