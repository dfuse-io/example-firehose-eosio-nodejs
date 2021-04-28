const path = require("path")
const grpc = require("grpc")
const protoLoader = require("@grpc/proto-loader")
const ProtoBuf = require("protobufjs")
const { createDfuseClient } = require("@dfuse/client")

// Global required by dfuse client
global.fetch = require("node-fetch")
global.WebSocket = require("ws")

const bstreamProto = loadProto("dfuse/bstream/v1/bstream.proto")
const eosioProto = loadProto("dfuse/eosio/codec/v1/codec.proto")

const bstreamService = loadGrpcPackageDefinition("dfuse/bstream/v1/bstream.proto").dfuse.bstream.v1

const blockMsg = bstreamProto.root.lookupType("dfuse.bstream.v1.Block")
const eosioBlockMsg = eosioProto.root.lookupType("dfuse.eosio.codec.v1.Block")

async function main() {
  if (process.argv.length <= 2) {
    console.error("Error: Wrong number of arguments")
    console.error()
    console.error("usage: node index.js <apiKey> [--full]")
    process.exit(1)
  }

  const dfuse = createDfuseClient({
    apiKey: process.argv[2],
    network: "blocks.mainnet.eos.dfuse.io",
  })

  const client = new bstreamService.BlockStreamV2(
    "blocks.mainnet.eos.dfuse.io:443",
    grpc.credentials.createSsl()
  )

  const showFull = process.argv.length > 3 && process.argv[3] == "--full"

  await new Promise(async (resolve, reject) => {
    const metadata = new grpc.Metadata()
    metadata.set("authorization", (await dfuse.getTokenInfo()).token)

    const stream = client.Blocks(
      {
        start_block_num: 150000000,
        stop_block_num: 150000005,
        include_filter_expr: 'action == "onblock"',
      },
      metadata
    )

    stream.on("data", (data) => {
      const { block: rawBlock } = data
      if (rawBlock.type_url !== "type.googleapis.com/dfuse.eosio.codec.v1.Block") {
        rejectStream(stream, reject, invalidTypeError(rawBlock.type_url))
        return
      }

      switch (data.step) {
        case "STEP_NEW":
          // Block is the new head block of the chain
          break
        case "STEP_UNDO":
          // Block has been forked out, should undo everything
          break
        case "STEP_IRREVERSIBLE":
          // Block is now irreversible, it's number will be ~360 blocks in the past
          break
      }

      const block = eosioBlockMsg.decode(rawBlock.value)

      // Use the "filtered" versions since all blocks returned by Firehose is always filtered
      const transactionCount = block.filteredTransactionTraces.length
      let actionCount = 0
      let systemActionCount = 0

      block.filteredTransactionTraces.forEach((trace) => {
        trace.actionTraces.forEach((actionTrace) => {
          actionCount += 1

          if (actionTrace.receiver === "eosio") {
            systemActionCount += 1
          }
        })
      })

      console.log(
        `Block #${block.number} (${block.id}) - ${transactionCount} Transactions, ${actionCount} Actions (${systemActionCount} System Actions)`
      )
      if (showFull) {
        console.log(JSON.stringify(block, null, "  "))
      }
    })

    stream.on("error", (error) => {
      rejectStream(stream, reject, error)
    })

    stream.on("status", (status) => {
      if (status.code === 0) {
        resolveStream(stream, resolve)
        return
      }

      // On error, I've seen the "error" callback receiving it, so not sure in which case we would do something else here
    })
  })

  // Clean up resources, should be performed only if the gRPC client (`client` here) and/or the dfuse client
  // (`dfuse` here) are not needed anymore. If you have pending stream, you should **not** close those since
  // they are required to make the stream works correctly.
  client.close()
  dfuse.release()
}

function loadGrpcPackageDefinition(package) {
  const protoPath = path.resolve(__dirname, "proto", package)

  const proto = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  })

  return grpc.loadPackageDefinition(proto)
}

function loadProto(package) {
  const protoPath = path.resolve(__dirname, "proto", package)

  return ProtoBuf.loadSync(protoPath)
}

function resolveStream(stream, resolver) {
  stream.cancel()
  resolver()
}

function rejectStream(stream, rejection, error) {
  stream.cancel()
  rejection(error)
}

function invalidTypeError(type) {
  return new Error(
    `invalid message type '${type}' received, are you connecting to the right endpoint?`
  )
}

main()
  .then(() => {
    console.log("Completed")
  })
  .catch((error) => {
    console.error("An error occurred", error)
  })
