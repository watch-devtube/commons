import * as _ from 'lodash'

const Storage = require('@google-cloud/storage')

import { Bucket, File } from '@google-cloud/storage'

export class GoogleBucket {

  private bucket: Bucket

  constructor(bucket: string) {
    this.bucket = new Storage().bucket(bucket)
  }

  name = () => this.bucket.name
  
  count = (): Promise<number> => this.bucket.getFiles().then(files => files.map(a => a.length).reduce((a, b, i, arr) => a + b))

  files = (): Promise<File[]> => this.bucket.getFiles().then(files => _.flatten(files))

  deleteAll = (): Promise<void> => this.bucket.deleteFiles()
  
  save = (path: string, data: string | Buffer): Promise<void> => this.bucket.file(path).save(data)

  makePublic = (path: string): Promise<void> => this.bucket.file(path).acl.add({ entity: 'allUsers', role: 'READER' }).then((response) => {
    let acl = response[0]
    let apiResponse = response[1]
  })

  get = (path: string): Promise<string> => this.bucket.file(path).download().then(bs => Buffer.concat(bs).toString())

}
