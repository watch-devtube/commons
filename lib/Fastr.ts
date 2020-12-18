import * as fs from "fs";
import * as path from "path";
import * as Lunr from "lunr";
import * as Loki from "lokijs";

import { Logger } from "./Logger";
import { Sorting } from "./Sorting";
import { alwaysArray } from "./Arrays";

export interface FastrOptions {
  dataDir?: string;
  today?: Date;
  documents?: Video[];
  serialized?: boolean;
  lokiDir?: string;
  lunrDir?: string;
  lokiData?: string | Buffer;
  lunrData?: string | Buffer;
  buildOnly?: "loki" | "lunr";
}

export interface Language {
  name: string;
  videoCount: number;
}

export interface Speaker {
  twitter: string;
  name: string;

}

export interface Year {
  year: number;
  videoCount: number;
}

export interface Video {
  objectID: string;
  title: string;
  satisfaction: number;
  creationDate: number;
  recordingDate: number;
  speaker: Speaker | Speaker[];
  channelId: string;
  channelTitle: string;
  language: string;
  tags: string[];
}

const allowedFields = [
  // "id",
  "objectID",
  // "title",
  "featured",
  "channelTitle",
  // "likes",
  // "dislikes",
  // "views",
  // "duration",
  "recordingDate",
  // "creationDate",
  "tags",
  "speaker",
  // "language",
  "satisfaction",
];

export interface SerializedIndex {
  loki: string;
  lunr: string;
}

export default class Fastr {
  private loki: Loki;
  private lunr: Lunr.Index;

  private videos: Collection<Video>;

  constructor(options: FastrOptions) {
    this.reload(options);
  }

  reload(options: FastrOptions) {
    Logger.time("Create empty Loki database");
    this.loki = new Loki("mem.db", { adapter: new Loki.LokiMemoryAdapter() });
    Logger.timeEnd("Create empty Loki database");

    if (!options.serialized) {
      let docs;
      if (options.dataDir) {
        docs = this.listDocuments(path.resolve(options.dataDir));
      } else if (options.documents) {
        docs = options.documents;
      } else {
        throw { message: "Neither 'dataDir' nor 'docs' are specified!" };
      }
      this.initLokiCollections();
      if (options.buildOnly === "lunr") {
        this.buildLunrIndex(docs);
      } else if (options.buildOnly === "loki") {
        this.buildLunrIndex([]);
        this.buildLokiIndex(docs);
      } else {
        this.buildLunrIndex(docs);
        this.buildLokiIndex(docs);
      }
    } else {
      if (options.dataDir) {
        this.loadIndex(path.resolve(options.dataDir));
      } else if (options.lokiDir) {
        const lokiData = fs.readFileSync(path.join(path.resolve(options.lokiDir), "loki.json"))
        this.loadLokiIndex(lokiData);
      } else if (options.lunrDir) {
        const lunrData = fs.readFileSync(path.join(path.resolve(options.lunrDir), "lunr.json"))
        this.loadLunrIndex(lunrData);
      } else if (options.lokiData || options.lunrData) {
        this.loadLokiIndex(options.lokiData);
        this.loadLunrIndex(options.lunrData);
      } else {
        throw {
          message:
            "Neither 'dataDir' nor 'lokiData' nor 'lunrData' are specified!",
        };
      }
    }
  }

  private buildLunrIndex(docs: Video[]) {
    Logger.time("Populate Lunr index");

    let builder = new Lunr.Builder();

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
    builder.field("tags", {
      extractor: (doc: Video) => (doc.tags ? doc.tags.join(" ") : doc.tags),
    });
    builder.field("channelTitle");

    Logger.time("Add all documents to Lunr index");
    docs.forEach((video) => builder.add(video));
    Logger.timeEnd("Add all documents to Lunr index");

    Logger.time("Build Lunr index");
    this.lunr = builder.build();
    Logger.timeEnd("Build Lunr index");

    Logger.timeEnd("Populate Lunr index");
  }

  private buildLokiIndex(docs: Video[]) {
    Logger.time("Populate Loki database");
    docs.forEach((video) => {
      this.leaveOnlySpeakersTwitter(video);
      this.videos.insert(this.filterFields(video));
    });
    Logger.timeEnd("Populate Loki database");
  }

  leaveOnlySpeakersTwitter = (object: any): any => {
    object.speaker = alwaysArray(object.speaker).map(speaker => {
      delete speaker.name
      return speaker.twitter
    })
  }

  filterFields = (object: any): any => {
    Object.keys(object).forEach((field) => {
      if (allowedFields.indexOf(field) == -1) {
        delete object[field];
      }
    });
    return object;
  };

  private initLokiCollections() {
    Logger.time(`Creating empty video collection`);
    this.videos = this.loki.addCollection(`videos`, {
      unique: ["objectID"]
    });
    Logger.timeEnd(`Creating empty video collection`);
  }

  private loadIndex(dataHome: string) {
    Logger.time(`Loading Loki and Lunr data from ${dataHome}`);
    this.loadLokiIndex(
      fs.readFileSync(path.join(path.resolve(dataHome), "loki.json"))
    );
    this.loadLunrIndex(
      fs.readFileSync(path.join(path.resolve(dataHome), "lunr.json"))
    );
    Logger.timeEnd(`Loading Loki and Lunr data from ${dataHome}`);
  }

  private loadLokiIndex(serializedIndex: string | Buffer) {
    if (serializedIndex instanceof Buffer) {
      Logger.time(`Loading Loki data from Buffer`);
      this.loki.loadJSON(serializedIndex.toString());
      Logger.timeEnd(`Loading Loki data from Buffer`);
    } else {
      Logger.time(`Loading Loki data from string`);
      this.loki.loadJSON(serializedIndex);
      Logger.timeEnd(`Loading Loki data from string`);
    }
    Logger.time(`Retrieving Loki collections`);
    this.videos = this.loki.getCollection("videos");
    Logger.timeEnd(`Retrieving Loki collections`);
  }

  private loadLunrIndex(serializedIndex: string | Buffer) {
    Logger.time(`Loading Lunr data`);
    this.lunr = Lunr.Index.load(JSON.parse(serializedIndex.toString()));
    Logger.timeEnd(`Loading Lunr data`);
  }

  serialize(): SerializedIndex {
    return {
      loki: this.loki.serialize(),
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

  searchInLunr(query: string, sortingSpecs: string[]): Video[] {
    let sorting = new Sorting(sortingSpecs);
    let hits = this.lunr.search(query);
    return hits
      .map((hit) => this.videos.by("objectID", hit.ref))
      .sort(sorting.lunr());
  }

  searchInLoki(refinement = {}, sortingSpecs: string[]): Video[] {
    let sorting = new Sorting(sortingSpecs);
    return this.videos
      .chain()
      .find(refinement)
      .compoundsort(sorting.loki())
      .data();
  }

  private stripMetadata<T>(lokiRecord: T & LokiObj): T {
    const cleanRecord = Object.assign({}, lokiRecord);
    delete cleanRecord["meta"];
    delete cleanRecord["$loki"];
    return cleanRecord;
  }

  private listDocuments(dataHome: string): Video[] {
    Logger.info(`Loading .json docs from dir ${dataHome}`);
    Logger.time(`Loading .json docs from dir ${dataHome}`);

    let docs = this.walkDirSync(dataHome)
      .filter((f) => f.endsWith(".json"))
      .map((f) => JSON.parse(fs.readFileSync(f).toString()));

    Logger.timeEnd(`Loading .json docs from dir ${dataHome}`);
    Logger.info(`${docs.length} docs loaded`);

    return docs;
  }

  private walkDirSync(dir: string, fileList: string[] = []): string[] {
    fs.readdirSync(dir).forEach((file) => {
      fileList = fs.statSync(path.join(dir, file)).isDirectory()
        ? this.walkDirSync(path.join(dir, file), fileList)
        : fileList.concat(path.join(dir, file));
    });
    return fileList;
  }
}
