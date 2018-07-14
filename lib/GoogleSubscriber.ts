
import * as util from 'util'
import * as _ from 'lodash'

const SubscriberClient = require('@google-cloud/pubsub/src/v1/subscriber_client')

export interface Status {
  received: number
  processed: number
}

export class GoogleSubscriber {

  private subscriber
  private subscriptionPath: string 
  private timeout: number

  constructor(projectId: string, subscription: string, timeout: number = 10000) {
    this.subscriber = new SubscriberClient({ projectId: projectId })
    this.subscriptionPath = `projects/${projectId}/subscriptions/${subscription}`
    this.timeout = timeout
  }

  pull = (messageCount: number = 25, callback: Function): Promise<Status> => {
    return this.repeat(() => 
      this.subscriber.pull(this.pullRequest(messageCount), this.requestOptions())
    ).then(result => 
      this.processMessages(result, callback)
    ).catch(e => {
      if (e.code && e.code == 4 && e.details == 'Deadline Exceeded') {
        console.debug("No data in the topic!")        
        return { received: 0, processed: 0 } as Status
      } else {
        console.error(`ERROR MESSAGE PROCESSING: ${util.inspect(e)}`) 
        throw e
      }        
    })
  }

  private processMessages = async (result, callback: Function): Promise<Status> => {
    let receivedMessageCount = 0
    let processedMessageCount = 0
    for (let i = 0; i < result.length; i++) {
      let chunks = _.chunk(result[i].receivedMessages, 100) 
      for (let chunk = 0; chunk < chunks.length; chunk++) {      
        let messageGroup = chunks[chunk] as any
        let messages = []
        for (let j = 0; j < messageGroup.length; j++) {        
          messages.push(JSON.parse(await messageGroup[j].message.data.toString()))
        }
        receivedMessageCount += messageGroup.length
        await callback(messages)
        processedMessageCount += messageGroup.length
        console.debug(`PROCESSED ${messageGroup.length} MESSAGES`)         
        await this.subscriber.acknowledge({
          subscription: this.subscriptionPath, 
          ackIds: messageGroup.map(m => m.ackId)
        })          
      }
    }

    return { received: receivedMessageCount, processed: processedMessageCount } as Status
    
  }

  private async repeat(func: Function): Promise<any> {
    let result = undefined
    let repeat = true
    let repeatCount = 0
    while (repeat) {
      try {
        result = await func()
        repeat = false
      } catch (e) {
        if (e.code && e.code == 14 && e.metadata && _.includes(e.metadata.details, 'code=8a75')) {  
          console.error("PUBSUB CONNECTION ERROR: " + JSON.stringify(e)) 
          if (repeatCount > 10) {
            throw e
          } else  {
            repeat = true
          }          
          repeatCount++
        } else {
          throw e
        }
      }
    }
    return result
  }

  private pullRequest = (messageCount: number): any => {
    return { 
      subscription: this.subscriptionPath, 
      maxMessages: messageCount,
      returnImmediately: false 
    }
  }

  private requestOptions = (): any => {
    return { 
      timeout: this.timeout, 
      retry: 1 
    }
  }

}