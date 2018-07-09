
import * as fs from 'fs'
import * as path from 'path'
import * as Lunr from 'lunr'
import * as Loki from 'lokijs'

import { firstBy } from 'thenby'
import { Logger } from './Logger'

export default class Fastr {

  private loki: Loki
  private lunr: Lunr.Index

  private tags: Set<string>

  private videos: any
  private speakers: any
  private channels: any

  constructor(dataSource: string | any[], serialized: boolean = false) {

    this.loki = new Loki('mem.db')

    if (!serialized) {
      this.buildIndex(dataSource)
    } else {
      if (typeof dataSource === "string") {
        this.loadIndex(path.resolve(dataSource))
      } else {
        throw { message: "Invalid serialization data source" }
      }
    }

  }

  private buildIndex(dataSource: string | any[]) {

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

    this.tags = new Set<string>()

    let builder = new Lunr.Builder()
    builder.pipeline.remove(Lunr.trimmer)

    builder.ref('objectID')
    builder.field('title')
    builder.field('speaker', { extractor: (doc) => doc.speaker ? doc.speaker.name : doc.speaker })
    builder.field('tags', { extractor: (doc) => doc.tags ? doc.tags.join(' ') : doc.tags })
    builder.field('channelTitle')

    let docs
    if (typeof dataSource === "string") {
      docs = this.listDocuments(path.resolve(dataSource))
    } else {
      docs = dataSource
    }

    docs.forEach(video => {

      builder.add(video)

      if (video.speaker && !this.speakers.by("twitter", video.speaker.twitter)) {
        this.speakers.insert(video.speaker)  
      }

      if (!this.channels.by("id", video.channelId)) {
        this.channels.insert({
          id: video.channelId,
          title: video.channelTitle
        } as any)
      }

      if (video.tags) {
        video.tags.forEach(tag => this.tags.add(tag))
      }

      this.videos.insert(video)

    })
    
    this.lunr = builder.build()

  }

  private loadIndex(dataHome: string) {

    this.loki.loadJSON(fs.readFileSync(path.join(path.resolve(dataHome), 'loki.json')).toString())
    this.lunr = Lunr.Index.load(JSON.parse(fs.readFileSync(path.join(path.resolve(dataHome), 'lunr.json')).toString()))

    this.tags = new Set<string>(JSON.parse(fs.readFileSync(path.join(path.resolve(dataHome), 'tags.json')).toString()))

    this.videos = this.loki.getCollection('videos')
    this.speakers = this.loki.getCollection('speakers')
    this.channels = this.loki.getCollection('channels')

  }

  serialize(dir: string) {
    let absDir = path.resolve(dir)
    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir)
    }    
    fs.writeFileSync(path.join(absDir, 'tags.json'), JSON.stringify(Array.from(this.tags)))
    fs.writeFileSync(path.join(absDir, 'loki.json'), this.loki.serialize())    
    fs.writeFileSync(path.join(absDir, 'lunr.json'), JSON.stringify(this.lunr))
  }

  searchChannels() {
    return this.channels.chain().simplesort('title').data().map(this.stripMetadata)
  }

  searchTags() {
    return Array.from(this.tags).sort()
  }

  searchSpeakers() {
    return this.speakers.chain().simplesort('name').data().map(this.stripMetadata)
  }

  search(query: string, refinement = {}, sortProperty: string) {
    if (query) {
      return this.searchInLunr(query, sortProperty)
    } else {
      return this.searchInLoki(refinement, sortProperty)
    }
  }

  private searchInLoki(refinement = {}, sortProperty: string) {
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

  private stripMetadata(lokiRecord: any) {
    const cleanRecord = Object.assign({}, lokiRecord)
    delete cleanRecord['meta']
    delete cleanRecord['$loki']
    return cleanRecord
  }

  private listDocuments(dataHome: string): any[] {    
    
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