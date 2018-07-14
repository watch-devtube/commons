
import * as _ from 'lodash'

const Storage = require('@google-cloud/storage')

import { Bucket, File } from '@google-cloud/storage'

export class GoogleBucket {

  private bucket: Bucket

  constructor(bucket: string) {
    this.bucket = new Storage().bucket(bucket)
  }

  count = (): Promise<number> => this.bucket.getFiles().then(files => files.map(a => a.length).reduce((a, b, i, arr) => a + b))

  files = (): Promise<File[]> => this.bucket.getFiles().then(files => _.flatten(files))

  deleteAll = (): Promise<void> => this.bucket.deleteFiles()
  
  save = (path: string, data: string | Buffer): Promise<void> => this.bucket.file(path).save(data)

  get = (path: string): Promise<string> => this.bucket.file(path).download().then(bs => Buffer.concat(bs).toString())

}
