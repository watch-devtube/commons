import { firstBy } from 'thenby'

class SortSpec {
  order: number
  property: string

  constructor(spec) {
    this.order = spec.startsWith("-") ? -1 : 1
    this.property = spec.replace("-", "") 
  }
}

export class Sorting {

  specs: SortSpec[]

  constructor(specs: string[]) {
    this.specs = specs.map(it => new SortSpec(it))
  }

  loki(): any[] {
    return this.specs.map(s => <any>[s.property, s.order == -1])
  }

  lunr(): IThenBy<any> {
    let [primary, secondary] = this.specs
    
    if (!secondary) {
      return firstBy(primary.property, primary.order)
    } else {
      return firstBy(primary.property, primary.order)
              .thenBy(secondary.property, secondary.order)
    }
  }
  

}