
import * as fs from 'fs'
import * as path from 'path'
import * as Lunr from 'lunr'
import * as Loki from 'lokijs'

import { firstBy } from 'thenby'
import { Logger } from './Logger'

export default class Fastr {

  lunr: Lunr

  tags: Set<string>

  videos: any
  speakers: any
  channels: any

  constructor(docsHome: string, dbName: string = 'mem.db') {

    let loki = new Loki(dbName)
    
    let videos = loki.addCollection(`${dbName}-videos`, { 
      unique: ['objectID'],
      indices: ['satisfaction']
    })

    let speakers = loki.addCollection(`${dbName}-speakers`, { 
      unique: ['twitter']
    })

    let channels = loki.addCollection(`${dbName}-channels`, { 
      unique: ['id']
    })    

    let tags = new Set<string>()

    this.tags = tags
    this.channels = channels
    this.speakers = speakers
    this.videos = videos

    let docLoader = () => {
      let walkSync = (dir, filelist = []) => {
          fs.readdirSync(dir).forEach(file => {
            filelist = fs.statSync(path.join(dir, file)).isDirectory()
              ? walkSync(path.join(dir, file), filelist)
              : filelist.concat(path.join(dir, file))
          })
          return filelist
      }

      Logger.info(`Loading .json docs from dir ${docsHome}`)

      let docs = walkSync(docsHome)
        .filter(f => f.endsWith('.json'))
        .map(f => JSON.parse(fs.readFileSync(f).toString()))

      Logger.info(`${docs.length} docs loaded`)
      return docs
    }     

    let docsLoaded = docLoader() 

    this.lunr = Lunr(function () {

      this.pipeline.remove(Lunr.trimmer)

      this.ref('objectID')
      this.field('title')
      this.field('speaker', { extractor: (doc) => doc.speaker ? doc.speaker.name : doc.speaker })
      this.field('tags', { extractor: (doc) => doc.tags ? doc.tags.join(' ') : doc.tags })
      this.field('channelTitle')

      docsLoaded.forEach(video => {

        this.add(video)

        if (video.speaker && !speakers.by("twitter", video.speaker.twitter)) {
          speakers.insert(video.speaker)  
        }

        if (!channels.by("id", video.channelId)) {
          channels.insert({
            id: video.channelId,
            title: video.channelTitle
          } as any)
        }

        if (video.tags) {
          video.tags.forEach(tag => tags.add(tag))
        }

        videos.insert(video)

      })
    })    
  }

  stripMetadata(loki_rec) {
    const clean_rec = Object.assign({}, loki_rec)
    delete clean_rec['meta']
    delete clean_rec['$loki']
    return clean_rec
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

  serialize(path: string) {
    fs.writeFileSync(path, JSON.stringify(this.lunr))
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

}