
import { Sorting } from '../Sorting'

describe('Sorting.ts', () => {

  it('sorting for loki', () => {
    let sorting = new Sorting(["-hello", "world"])
    expect(sorting.loki()).toEqual([ ["hello", true], ["world", false] ])
  })

  it('sorting for lunr', () => {
    let sorting = new Sorting(["-featured", "-satisfaction"])
    let itemsForSorting = [
      {
        satisfaction: 1,
        featured: true
      },
      {
        satisfaction: 2,
        featured: false
      },      
      {
        satisfaction: 3,
        featured: true
      },      
      {
        satisfaction: 10,
        featured: false
      }
    ]
    let sortedItems = itemsForSorting.sort(sorting.lunr())
    expect(sortedItems).toEqual(
      [
        {
          satisfaction: 3,
          featured: true
        },        
        {
          satisfaction: 1,
          featured: true
        },      
        {
          satisfaction: 10,
          featured: false
        },
        {
          satisfaction: 2,
          featured: false
        }        
      ]      
    )
  })

})