
export function Storage(options) {
  return {
    bucket: () => new Bucket()
  }
}

class Bucket {
  file = () => new File()
}

class File {
  save = () => {}
}

module.exports = Storage
