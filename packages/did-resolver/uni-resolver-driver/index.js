'use strict';

const Hapi = require('@hapi/hapi')
const { resolve: resolveStacksDid } = require('./stacks-resolver')

const init = async () => {
  const server = Hapi.server({
    port: 8080,
    host: '0.0.0.0'
  })

  server.route({
    method: 'GET',
    path: '/identifiers/{identifier}',
    handler: async (request, h) => {
      const did = request.params['identifier']
      let resp
      try {
        resp = h.response(await resolveStacksDid(did))
        resp.code(200)
      } catch (err) {
        resp = h.response({ error: err.message })
        resp.code(400)
        console.error(`failed to resolve ${did}`, err)
      }
      return resp
    }
  })

  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {
  console.error('unhandled rejection!', err)
  process.exit(1)
})

process.on('SIGINT', () => {
  console.log('Received SIGINT. Quitting.')
  process.exit(0)
})

init()
