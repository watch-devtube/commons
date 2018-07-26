
import * as fs from 'fs'
import * as path from 'path'
import * as Lunr from 'lunr'
import * as Loki from 'lokijs'

import { firstBy } from 'thenby'
import { Logger } from './Logger'

export interface FastrOptions {
  dataDir?: string
  today?: Date
  documents?: Video[]
  serialized?: boolean
  lokiData?: string | Buffer
  lunrData?: string | Buffer
  buildOnly?: "loki" | "lunr"
}

export interface VideoStats {
  new: number
  total: number
}

export interface Tag {
  tag: string
  videos: VideoStats 
}

export interface Channel {
  id: string
  title: string
  videos: VideoStats
}

export interface Video {
  objectID: string
  title: string
  satisfaction: number
  creationDate: number
  recordingDate: number
  speaker: Speaker
  channelId: string
  channelTitle: string
  tags: string[]
}

type VideoProperty = "objectID" | "speaker" | "title" | "tags" | "channelTitle" | "satisfaction" | "channelId" | "$loki" | "meta"

export interface Speaker {
  twitter: string
  name: string
  videos: VideoStats
}

export interface SerializedIndex {
  loki: string
  lunr: string
}

export default class Fastr {

  private today: Date
  private loki: Loki
  private lunr: Lunr.Index

  private tags: Collection<Tag>
  private videos: Collection<Video>
  private speakers: Collection<Speaker>
  private channels: Collection<Channel>

  constructor(options: FastrOptions) {
    this.today = options.today || new Date()
    this.reload(options)
  }

  reload(options: FastrOptions) {
    
    Logger.time('Create empty Loki database')
    this.loki = new Loki('mem.db', { adapter: new Loki.LokiMemoryAdapter() })
    Logger.timeEnd('Create empty Loki database')

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

    Logger.time('Populate Lunr index')

    let builder = new Lunr.Builder()

    builder.pipeline.remove(Lunr.trimmer)

    builder.ref('objectID')
    builder.field('title')
    builder.field('speaker', { extractor: (doc) => doc.speaker ? doc.speaker.name : doc.speaker })
    builder.field('tags', { extractor: (doc) => doc.tags ? doc.tags.join(' ') : doc.tags })
    builder.field('channelTitle')

    Logger.time('Add all documents to Lunr index')
    docs.forEach(video => builder.add(video))
    Logger.timeEnd('Add all documents to Lunr index')
    
    Logger.time('Build Lunr index')
    this.lunr = builder.build()
    Logger.timeEnd('Build Lunr index')

    Logger.timeEnd('Populate Lunr index')

  }

  private buildLokiIndex(docs: Video[]) {
    Logger.time('Populate Loki database')
    docs.forEach(video => {

      let now = this.today.getTime() / 1000
      let videoAgeInDays = (now - video.creationDate) / (60 * 60 * 24)
      let isNew = videoAgeInDays <= 7
      let videoStats = { total: 1, new: (isNew ? 1 : 0)} as VideoStats

      if (video.speaker) {
        let newSpeaker = { twitter: video.speaker.twitter, name: video.speaker.name, videos: videoStats} as Speaker
        let existingSpeaker = this.speakers.by("twitter", video.speaker.twitter)
        if (!existingSpeaker) {
          this.speakers.insert(newSpeaker)
        } else {
          existingSpeaker.videos.total = existingSpeaker.videos.total + 1
          existingSpeaker.videos.new = existingSpeaker.videos.new + (isNew ? 1 : 0)
          this.speakers.update(existingSpeaker)
        }
      }

      if (video.channelId) {
        let newChannel = { id: video.channelId, title: video.channelTitle, videos: videoStats } as Channel
        let existingChannel = this.channels.by("id", video.channelId)
        if (!existingChannel) {
          this.channels.insert(newChannel)
        } else {
          existingChannel.videos.total = existingChannel.videos.total + 1
          existingChannel.videos.new = existingChannel.videos.new + (isNew ? 1 : 0)
          this.channels.update(existingChannel)
        }
      }

      if (video.tags) {
        video.tags.forEach(tag => {
          let newTag = { tag: tag, videos: videoStats } as Tag
          let existingTag = this.tags.by("tag", tag)
          if (!existingTag) {
            this.tags.insert(newTag)
          } else {
            existingTag.videos.total = existingTag.videos.total + 1
            existingTag.videos.new = existingTag.videos.new + (isNew ? 1 : 0)
            this.tags.update(existingTag)  
          }
        })
      }

      this.videos.insert(video)

    })
    Logger.timeEnd('Populate Loki database')
  }

  private initLokiCollections() {

    Logger.time(`Creating empty video collection`)
    this.videos = this.loki.addCollection(`videos`, { 
      unique: ['objectID'],
      indices: ['satisfaction']
    })
    Logger.timeEnd(`Creating empty video collection`)

    Logger.time(`Creating empty speakers collection`)
    this.speakers = this.loki.addCollection(`speakers`, { 
      unique: ['twitter']
    })
    Logger.timeEnd(`Creating empty speakers collection`)

    Logger.time(`Creating empty channels collection`)
    this.channels = this.loki.addCollection(`channels`, { 
      unique: ['id']
    })    
    Logger.timeEnd(`Creating empty channels collection`)

    Logger.time(`Creating empty tags collection`)
    this.tags = this.loki.addCollection(`tags`, { 
      unique: ['tag']
    })
    Logger.timeEnd(`Creating empty tags collection`)

  }

  private loadIndex(dataHome: string) {
    Logger.time(`Loading Loki and Lunr data from ${dataHome}`)
    this.loadLokiIndex(fs.readFileSync(path.join(path.resolve(dataHome), 'loki.json')))
    this.loadLunrIndex(fs.readFileSync(path.join(path.resolve(dataHome), 'lunr.json')))
    Logger.timeEnd(`Loading Loki and Lunr data from ${dataHome}`)
  }

  private loadLokiIndex(serializedIndex: string | Buffer) {
    if (serializedIndex instanceof Buffer) {
      Logger.time(`Loading Loki data from Buffer`)
      this.loki.loadJSON(serializedIndex.toString())
      Logger.timeEnd(`Loading Loki data from Buffer`)
    } else {
      Logger.time(`Loading Loki data from string`)
      this.loki.loadJSON(serializedIndex)
      Logger.timeEnd(`Loading Loki data from string`)
    }    
    Logger.time(`Retrieving Loki collections`)
    this.tags = this.loki.getCollection('tags')
    this.videos = this.loki.getCollection('videos')
    this.speakers = this.loki.getCollection('speakers')
    this.channels = this.loki.getCollection('channels')
    Logger.timeEnd(`Retrieving Loki collections`)
  }

  private loadLunrIndex(serializedIndex: string | Buffer) {
    Logger.time(`Loading Lunr data`)
    this.lunr = Lunr.Index.load(JSON.parse(serializedIndex.toString()))
    Logger.timeEnd(`Loading Lunr data`)
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

  listChannels(): Channel[] {
    return this.channels
      .chain()
      .compoundsort([<any>["videos.new", true], ["videos.total", true]])
      .data()
      .map(this.stripMetadata)
  }

  listTags(): Tag[] {
    return this.tags
      .chain()
      .compoundsort([<any>["videos.new", true], ["videos.total", true]])
      .data()
      .map(this.stripMetadata)
  }

  listSpeakers(): Speaker[] {
    return this.speakers
      .chain()
      .compoundsort([<any>["videos.new", true], ["videos.total", true]])
      .data()
      .map(this.stripMetadata)
  }

  listLatestVideos(): Video[] {
    const day = 24 * 60 * 60
    const today = Math.floor(Date.now() / 1000)
    const twoDaysOld = today - 2 * day
    return this.videos.chain().find({ 'creationDate': { '$gte': twoDaysOld } }).simplesort('creationDate', true).data().map(this.stripMetadata)
  }

  search(query: string, refinement = {}, sorting: string): Video[] {
    if (query) {
      return this.searchInLunr(query, sorting)
    } else {
      return this.searchInLoki(refinement, sorting)
    }
  }

  private searchInLunr(query: string, sorting: string): Video[] {
    let order = sorting.startsWith("-") ? -1 : 1
    let property = sorting.replace("-", "") as VideoProperty
    let hits = this.lunr.search(query)
    let hitsTotal = hits.length
    return hits
      .map(hit => this.videos.by("objectID", hit.ref))
      .sort(firstBy(property, order))
  }

  private searchInLoki(refinement = {}, sorting: string): Video[] {
    let descending = sorting.startsWith("-")
    let property = sorting.replace("-", "") as VideoProperty
    return this.videos
      .chain()
      .find(refinement)
      .simplesort(property, descending)
      .data()
  }

  private stripMetadata<T>(lokiRecord: T & LokiObj): T {
    const cleanRecord = Object.assign({}, lokiRecord)
    delete cleanRecord['meta']
    delete cleanRecord['$loki']
    return cleanRecord
  }

  private listDocuments(dataHome: string): Video[] {    
    
    Logger.info(`Loading .json docs from dir ${dataHome}`)
    Logger.time(`Loading .json docs from dir ${dataHome}`)

    let docs = this.walkDirSync(dataHome)
      .filter(f => f.endsWith('.json'))
      .map(f => JSON.parse(fs.readFileSync(f).toString()))
    
    Logger.timeEnd(`Loading .json docs from dir ${dataHome}`)      
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