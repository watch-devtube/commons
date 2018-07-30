

let files: File[] = []

export function Storage(options) {
  return {
    bucket: () => new Bucket()
  }
}

class Bucket {
  file = (name: string) => new File(name)
  getFiles = async () => [ files ]
  deleteFiles = async () => {
    files = []
  }
}

class File {
  private name: string
  private data: string
  constructor(name: string) {
    this.name = name
  }
  save = async (data: string | Buffer): Promise<void> => {
    this.data = data.toString()
    files.push(this) 
  }
  download = (): Promise<Buffer[]> => Promise.resolve(
    [ Buffer.from(files.find(f => f.name == this.name).data) ]
  )
  exists = (): Promise<boolean[]> => Promise.resolve(
    [ files.find(f => f.name == this.name) != undefined ] 
  )
}

module.exports = Storage
