
export class Logger {

  static enabled = false

  static debug = (message: string) => {
    if (Logger.enabled) {
      console.log(`debug: ${message}`)
    }
  }

  static info(message) {
    if (Logger.enabled) {
      console.log(`info: ${message}`)
    }    
  }

  static error(message) {
    if (Logger.enabled) {
      console.error(`error: ${message}`)
    }    
  }

}