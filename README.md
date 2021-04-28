## dfuse Firehose Node.js (JavaScript) Example

This simple program demonstrates how easy it is to stream full block details using StreamingFast gRPC
API:

- Request a token from our authentication API
- Creates a gRPC connection with credentials
- Instantiates a BlockStream client
- Start a stream of blocks
- Prints the blocks received

### Requirements

You will need to have Node.js 10+ as well as Yarn or NPM.

#### Quickstart

First of all, visit [https://app.dfuse.io/](https://app.dfuse.io/) to get a free API key for your project.

First, clone this repository to your work folder:

```bash
git clone https://github.com/dfuse-io/example-firehose-eosio-nodejs.git
cd example-firehose-eosio-nodejs
```

Install all dependencies:

```bash
yarn install
```

Once your environment is setup properly, simply run the `index.js` script:

```bash
node index.js YOUR_API_KEY_HERE
```

By default it prints light details about the blocks, use the `--full` flag to
print the full block in JSON:

```bash
node index.js YOUR_API_KEY_HERE --full
```

**Note** The default `JSON.stringify` will prints the various `bytes` type using `base64` encoding, this is unfortunate as it makes reading it in the JSON harder. If you find a quick option to print it as hexadecimal, open a PR we will be happy to merge it in.

#### dfuse Community Edition

The dfuse Firehose service is also available via EOS Nation dfuse Community Edition. Access to the dfuse Community Edition does not require authentication, and is rate-limited. A higher rate limit is available to authenticatated users. The service being shared with the whole community, please be mindful of your requests. To create an API key for the dfuse Community Edition, visit [EOS Nation Account Page](https://account.eosnation.io).

Update the example `createDfuseClient` to looks like:

```
  const dfuse = createDfuseClient({
    apiKey: process.argv[2],
    network: "eos.firehose.eosnation.io",
  })
```

And ` bstreamService.BlockStreamV2` call to looks like:

```
  const client = new bstreamService.BlockStreamV2(
    "eos.firehose.eosnation.io:9000",
    grpc.credentials.createSsl()
  )
```
