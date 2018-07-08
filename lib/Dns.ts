
import * as dns from 'dns'
import * as dnscache from 'dnscache'

import { Logger } from './Logger'

export class Dns {

  constructor() {

    let algoliaAppId = 'DR90AOGGE9'

    let dnsCache = dnscache({
      enable: true,
      ttl: 300,
      cachesize: 1000
    })

    let dnsNames = [ 
      'www.github.com', 
      'github.com', 
      'api.github.com', 
      'www.googleapis.com', 
      'www.google.com', 
      'googleapis.com',
      'www.googleapis.com',  
      'www.algolia.com',
      'algolia.com',  
      `${algoliaAppId}.algolia.net`,
      `${algoliaAppId}-dsn.algolia.net`,
      `${algoliaAppId}-1.algolianet.com`,
      `${algoliaAppId}-2.algolianet.com`,
      `${algoliaAppId}-3.algolianet.com`  
    ]

    dnsNames.forEach(dnsName => {
      dnsCache.lookup(dnsName, (err, result) => {
        if (err) {
          Logger.error(`DNS ERROR: ${dnsName}: ${JSON.stringify(err)}`)
        } else {
          Logger.debug(`DNS QUERY: ${dnsName}: ${JSON.stringify(result)}`)
        }    
      })  
    })
    
  }

}

export function dnsCache() {
  return new Dns()
}