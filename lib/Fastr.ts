
import * as fs from 'fs'
import * as path from 'path'
import * as Lunr from 'lunr'
import * as Loki from 'lokijs'

import { firstBy } from 'thenby'
import { Logger } from './Logger'

export interface FastrOptions {
  dataDir?: string
  documents?: Video[]
  serialized?: boolean
  lokiData?: string | Buffer
  lunrData?: string | Buffer
  buildOnly?: "loki" | "lunr"
}

export interface Tag {
  tag: string
}

export interface Channel {
  id: string
  title: string
}

export interface Video {
  objectID: string
  title: string
  satisfaction: number
  speaker: Speaker
  channelId: string
  channelTitle: string
  tags: string[]
}

type VideoProperty = "objectID" | "speaker" | "title" | "tags" | "channelTitle" | "satisfaction" | "channelId" | "$loki" | "meta"

export interface Speaker {
  twitter: string
  name: string
}

export interface SerializedIndex {
  loki: string
  lunr: string
}

export default class Fastr {

  private loki: Loki
  private lunr: Lunr.Index

  private tags: Collection<Tag>
  private videos: Collection<Video>
  private speakers: Collection<Speaker>
  private channels: Collection<Channel>

  constructor(options: FastrOptions) {
    this.reload(options)
  }

  reload(options: FastrOptions) {

    this.loki = new Loki('mem.db')

    if (!options.serialized) {
      let docs
      if (options.dataDir) {
        docs = this.listDocuments(path.resolve(options.dataDir))        
      } else if (options.documents) {
        docs = options.documents
      } else {
        throw { message: "Neither 'dataDir' nor 'docs' are specified!" }        
      }
      this.initLokiCollections()
      if (options.buildOnly === "lunr") {
        this.buildLunrIndex(docs)
      } else if (options.buildOnly === "loki") {
        this.buildLunrIndex([])
        this.buildLokiIndex(docs)
      } else {
        this.buildLunrIndex(docs)
        this.buildLokiIndex(docs)
      }        
    } else {
      if (options.dataDir) {
        this.loadIndex(path.resolve(options.dataDir))
      } else if (options.lokiData || options.lunrData) {
        this.loadLokiIndex(options.lokiData)
        this.loadLunrIndex(options.lunrData)
      } else {
        throw { message: "Neither 'dataDir' nor 'lokiData' nor 'lunrData' are specified!" }
      }
    }

  }

  private buildLunrIndex(docs: Video[]) {

    let builder = new Lunr.Builder()

    builder.pipeline.remove(Lunr.trimmer)

    builder.ref('objectID')
    builder.field('title')
    builder.field('speaker', { extractor: (doc) => doc.speaker ? doc.speaker.name : doc.speaker })
    builder.field('tags', { extractor: (doc) => doc.tags ? doc.tags.join(' ') : doc.tags })
    builder.field('channelTitle')

    docs.forEach(video => builder.add(video))
    
    this.lunr = builder.build()

  }

  private buildLokiIndex(docs: Video[]) {
    docs.forEach(video => {

      if (video.speaker && !this.speakers.by("twitter", video.speaker.twitter)) {
        this.speakers.insert(video.speaker)  
      }

      if (!this.channels.by("id", video.channelId)) {
        this.channels.insert({
          id: video.channelId,
          title: video.channelTitle
        })
      }

      if (video.tags) {
        video.tags.forEach(tag => {
          let lokiTag = { tag: tag }
          if (!this.tags.findObject(lokiTag)) {
            this.tags.insert(lokiTag)
          }
        })
      }

      this.videos.insert(video)

    })
  }

  private initLokiCollections() {

    this.videos = this.loki.addCollection(`videos`, { 
      unique: ['objectID'],
      indices: ['satisfaction']
    })

    this.speakers = this.loki.addCollection(`speakers`, { 
      unique: ['twitter']
    })

    this.channels = this.loki.addCollection(`channels`, { 
      unique: ['id']
    })    

    this.tags = this.loki.addCollection(`tags`, { 
      unique: ['tag']
    })

  }

  private loadIndex(dataHome: string) {
    this.loadLokiIndex(fs.readFileSync(path.join(path.resolve(dataHome), 'loki.json')).toString())
    this.loadLunrIndex(JSON.parse(fs.readFileSync(path.join(path.resolve(dataHome), 'lunr.json')).toString()))
  }

  private loadLokiIndex(serializedIndex: string | Buffer) {
    if (serializedIndex instanceof Buffer) {
      this.loki.loadJSON(serializedIndex.toString())
    } else {
      this.loki.loadJSON(serializedIndex)
    }    
    this.tags = this.loki.getCollection('tags')
    this.videos = this.loki.getCollection('videos')
    this.speakers = this.loki.getCollection('speakers')
    this.channels = this.loki.getCollection('channels')
  }

  private loadLunrIndex(serializedIndex: string | Buffer) {
    this.lunr = Lunr.Index.load(serializedIndex)
  }

  serialize(): SerializedIndex {
    return {
      loki: this.loki.serialize(),
      lunr: JSON.stringify(this.lunr)
    }
  }

  serializeToDir(dir: string) {
    let index = this.serialize()
    let absDir = path.resolve(dir)
    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir)
    }    
    fs.writeFileSync(path.join(absDir, 'loki.json'), index.loki)    
    fs.writeFileSync(path.join(absDir, 'lunr.json'), index.lunr)
  }

  searchChannels() {
    return this.channels.chain().simplesort('title').data().map(this.stripMetadata)
  }

  searchTags() {
    return this.tags.chain().simplesort('tag').data().map(t => t.tag)
  }

  searchSpeakers() {
    return this.speakers.chain().simplesort('name').data().map(this.stripMetadata)
  }

  search(query: string, refinement = {}, sortProperty: VideoProperty) {
    if (query) {
      return this.searchInLunr(query, sortProperty)
    } else {
      return this.searchInLoki(refinement, sortProperty)
    }
  }

  private searchInLoki(refinement = {}, sortProperty: VideoProperty) {
    let descending = true
    return this.videos
      .chain()
      .find(refinement)
      .simplesort(sortProperty, descending)
      .data()
  }

  private searchInLunr(query: string, sortProperty: string) {
    let hits = this.lunr.search(query)
    let hitsTotal = hits.length
    return hits
      .map(hit => this.videos.by("objectID", hit.ref))
      .sort(firstBy(sortProperty, -1))
  }

  private stripMetadata(lokiRecord: (Video | Channel | Tag | Speaker) & LokiObj) {
    const cleanRecord = Object.assign({}, lokiRecord)
    delete cleanRecord['meta']
    delete cleanRecord['$loki']
    return cleanRecord
  }

  private listDocuments(dataHome: string): Video[] {    
    
    Logger.info(`Loading .json docs from dir ${dataHome}`)
    
    let docs = this.walkDirSync(dataHome)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(f).toString()))
    
    Logger.info(`${docs.length} docs loaded`)
    
    return docs    

  }

  private walkDirSync(dir: string, fileList: string[] = []): string[] {
    fs.readdirSync(dir).forEach(file => {
      fileList = fs.statSync(path.join(dir, file)).isDirectory()
        ? this.walkDirSync(path.join(dir, file), fileList)
        : fileList.concat(path.join(dir, file));
    })
    return fileList
  }

}