

class SubscriberClient {

  options

  constructor(options: any) {
    this.options = options
  }

  pull(request: any, options: any) {
    return Promise.resolve([])
  }

}

module.exports = SubscriberClient