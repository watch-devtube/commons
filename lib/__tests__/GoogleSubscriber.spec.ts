
import { GoogleSubscriber } from '../GoogleSubscriber'

describe('GoogleSubscriber.ts', () => {

  // TODO: test message processing works

  it('check subscriber processes empty message list', async () => {
    let subscriber = await new GoogleSubscriber("dev-tube", "github_file_subscription", 10000)
    await subscriber.pull(1, (msgs) => console.log(msgs))
  })

})