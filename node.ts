import smc from '@cspotcode/source-map'
import Kink from '@termsurf/kink'
import fs from 'fs'
import pathResolve from 'path'
import makeText from './index.js'

export * from './index.js'

const HOST_LINK_MESH: Record<string, smc.SourceMapConsumer> = {}

function loadHostLink(line: string): smc.SourceMapConsumer | void {
  const link = HOST_LINK_MESH[`${line}`]
  if (link) {
    return link
  }

  const fileLink = line.replace(/^file:\/\//, '')

  if (fs.existsSync(`${fileLink}.map`)) {
    const mapContent = fs.readFileSync(`${fileLink}.map`, 'utf-8')
    const json = JSON.parse(mapContent) as smc.RawSourceMap
    const sm = new smc.SourceMapConsumer(json)
    HOST_LINK_MESH[`${line}`] = sm
    return sm
  }
}

function readLinkBase(path: string): string {
  const relative = pathResolve.relative(process.cwd(), path)
  // get pnpm symlink path so it's nicer to see.
  if (relative.match(/^(node_modules\/\.pnpm\/.+\/node_modules)/)) {
    return `node_modules/${relative.slice(RegExp.$1.length)}`
  }
  return relative
}

function readLink(path: string, context: string): string {
  return readLinkBase(pathResolve.resolve(context, path))
}

function readHostLinkFile(
  file: string,
  line: number,
  rise: number,
): [string, number | undefined, number | undefined] {
  const link = loadHostLink(file)

  const trace = {
    column: rise,
    filename: file,
    line: line,
  }

  if (link) {
    const token = link.originalPositionFor(trace)
    if (token.source) {
      return [
        readLink(
          token.source,
          pathResolve.dirname(file.replace(/^file:\/\//, '')),
        ),
        token.line == null ? undefined : token.line,
        token.column == null ? undefined : token.column,
      ]
    } else {
      return [file, line, rise]
    }
  } else {
    return [readLinkBase(file), line, rise]
  }
}

export { makeText }

export function makeKinkText(kink: Kink): string {
  return makeText({
    time: kink.time,
    host: kink.host,
    code: kink.code,
    note: kink.note,
    list: kink.stack?.split('\n') ?? [],
    link: kink.link,
    hook: readHostLinkFile,
  })
}

export function makeBaseKinkText(kink: Error) {
  return makeText({
    time: Kink.makeTime(Date.now()),
    host: 'node',
    code:
      'code' in kink && typeof kink.code === 'string'
        ? kink.code
        : '0000',
    note: kink.message,
    list: kink.stack?.split('\n') ?? [],
    hook: readHostLinkFile,
  })
}
