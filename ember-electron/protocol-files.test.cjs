'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { resolveProtocolFile } = require('./protocol-files.cjs')

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'openarcanum-protocol-test-'))
  const root = path.join(temporary, 'root')
  fs.mkdirSync(path.join(root, 'Gfx', '2D'), { recursive: true })
  fs.writeFileSync(path.join(root, 'index.html'), 'application')
  fs.writeFileSync(path.join(root, 'Gfx', '2D', 'Image.png'), 'asset')
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }))
  return { temporary, root }
}

test('serves real UI files and extensionless routes, but never substitutes HTML for missing bundles', t => {
  const { root } = fixture(t)
  const options = { scheme: 'serve', host: 'app', index: true }
  assert.equal(resolveProtocolFile(root, 'serve://app/', options), path.join(root, 'index.html'))
  assert.equal(resolveProtocolFile(root, 'serve://app/game/map?x=1#camera', options), path.join(root, 'index.html'))
  assert.equal(resolveProtocolFile(root, 'serve://app/assets/missing.js', options), null)
  assert.equal(resolveProtocolFile(root, 'serve://app/index.html?cache=1', options), path.join(root, 'index.html'))
})

test('maps an asset URL host to its first directory and handles case-normalized Windows names', t => {
  const { root } = fixture(t)
  const options = { scheme: 'asset', caseInsensitive: true }
  assert.equal(resolveProtocolFile(root, 'asset://gfx/2d/image.png', options), path.join(root, 'Gfx', '2D', 'Image.png'))
  assert.equal(resolveProtocolFile(root, 'asset://Gfx/2D/Image.png?x=1', options), path.join(root, 'Gfx', '2D', 'Image.png'))
  assert.equal(resolveProtocolFile(root, 'asset://gfx/2D/absent.png', options), null)
})

test('rejects alternate hosts, credentials, ports and encoded traversal', t => {
  const { root } = fixture(t)
  const options = { scheme: 'serve', host: 'app', index: true }
  for (const url of [
    'https://app/index.html', 'serve://other/index.html', 'serve://user@app/index.html',
    'serve://app:9000/index.html', 'serve://app/%2f..%2foutside.txt',
    'serve://app/%5c..%5coutside.txt', 'serve://app/%00.txt', 'serve://app/%zz'
  ]) assert.throws(() => resolveProtocolFile(root, url, options), undefined, url)
})

test('rejects a symlink leading outside the selected data directory', t => {
  const { temporary, root } = fixture(t)
  const outside = path.join(temporary, 'outside.txt')
  fs.writeFileSync(outside, 'outside')
  try {
    fs.symlinkSync(outside, path.join(root, 'escape.txt'))
  } catch (error) {
    if (error.code === 'EPERM' && process.platform === 'win32') return t.skip('Symlink privilege unavailable')
    throw error
  }
  assert.throws(() => resolveProtocolFile(root, 'asset:///escape.txt', { scheme: 'asset' }), /Symlink outside/)
  assert.throws(() => resolveProtocolFile(root, 'asset:///ESCAPE.TXT', {
    scheme: 'asset', caseInsensitive: true
  }), /Symlink outside/)
})

test('returns a missing resource for an absent converted-data directory', t => {
  const { root } = fixture(t)
  assert.equal(resolveProtocolFile(path.join(root, 'absent'), 'asset://gfx/image.png', {
    scheme: 'asset', caseInsensitive: true
  }), null)
})
