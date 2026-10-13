// SPDX-License-Identifier: GPL-3.0-or-later
'use strict'

// All data and artwork in this module are authored here. No retail installation,
// converter output, network request or third-party graphics library is used.
const fs = require('node:fs/promises') as typeof import('node:fs/promises')
const path = require('node:path') as typeof import('node:path')
const zlib = require('node:zlib') as typeof import('node:zlib')

const MAP_ID = 'Inventory workshop'
const PREFIX = `${MAP_ID}/Sector/0/0`
const BOX_ID = `${PREFIX}/Container/owned-workshop-box.json`
const TOKEN_ID = `${PREFIX}/Generic/owned-workshop-token.json`
const TOKEN_LABEL = 'Workshop token'
const DOOR_ID = `${PREFIX}/Portal/owned-workshop-door.json`
const SCRIPTED_DOOR_ID = `${PREFIX}/Portal/owned-workshop-scripted-door.json`
const KEY_BOX_ID = `${PREFIX}/Container/owned-workshop-key-box.json`
const KEY_ID = `${PREFIX}/Key/owned-workshop-key.json`
const LOCKED_DOOR_ID = `${PREFIX}/Portal/owned-workshop-locked-door.json`
const LOCK_KEY_ID = 7001
const LOCKED_BOX_ID = `${PREFIX}/Container/owned-workshop-locked-box.json`
const PRIZE_ID = `${PREFIX}/Generic/owned-workshop-prize.json`
const PRIZE_LABEL = 'Workshop keepsake'
const GROUND_ITEM_ID = `${PREFIX}/Generic/owned-workshop-pebble.json`
const GROUND_ITEM_LABEL = 'Workshop pebble'
const BALLAST_BOX_ID = `${PREFIX}/Container/owned-workshop-ballast-box.json`
const BALLAST_ID = `${PREFIX}/Generic/owned-workshop-ballast.json`
const BALLAST_LABEL = 'Workshop ballast'
const BALLAST_WEIGHT = 4000
const NPC_ID = `${PREFIX}/Npc/owned-workshop-guide.json`
const NPC_LABEL = 'Workshop guide'
const CONVERSATION_ID = 'workshop-guide'
const QUEST_ID = 'a-closer-look'
const QUEST_TITLE = 'A closer look'
const QUEST_EXPERIENCE_REWARD = 2100
const PROGRESSION_BASELINE = Object.freeze({ experiencePoints: 0, level: 1, unspentPoints: 5,
  attributes: Object.freeze({ strength: 8, dexterity: 8, constitution: 8, beauty: 8,
    intelligence: 8, perception: 8, willpower: 8, charisma: 8 }) })
const DIRECTIONS = ['North', 'NorthEast', 'East', 'SouthEast', 'South', 'SouthWest', 'West', 'NorthWest']
const PALETTE = ['#00000000', '#162c38', '#274653', '#365663', '#517582', '#7598a1',
  '#a6bec1', '#d5ddca', '#eab769', '#ba793e', '#78513d', '#443737', '#529ba4',
  '#78c4bc', '#326e80', '#eddfab']
const RGBA = PALETTE.map(color => {
  const rgb = color.slice(1, 7)
  return [parseInt(rgb.slice(0, 2), 16), parseInt(rgb.slice(2, 4), 16), parseInt(rgb.slice(4, 6), 16),
    color.length === 9 ? parseInt(color.slice(7, 9), 16) : 255]
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer) {
  const name = Buffer.from(type)
  const result = Buffer.alloc(data.length + 12)
  result.writeUInt32BE(data.length)
  name.copy(result, 4)
  data.copy(result, 8)
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8)
  return result
}

function image(width: number, height: number) {
  const pixels = new Uint8Array(width * height)
  const pixel = (x: number, y: number, color: number) => {
    x = Math.floor(x); y = Math.floor(y)
    if (x >= 0 && x < width && y >= 0 && y < height) pixels[y * width + x] = color
  }
  const rectangle = (x: number, y: number, w: number, h: number, color: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) pixel(xx, yy, color)
  }
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pixel(x, y, color)
      }
    }
  }
  const polygon = (points: readonly (readonly [number, number])[], color: number) => {
    const minX = Math.floor(Math.min(...points.map(point => point[0])))
    const maxX = Math.ceil(Math.max(...points.map(point => point[0])))
    const minY = Math.floor(Math.min(...points.map(point => point[1])))
    const maxY = Math.ceil(Math.max(...points.map(point => point[1])))
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let inside = false
      for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
        const [ax, ay] = points[a], [bx, by] = points[b]
        if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
      }
      if (inside) pixel(x, y, color)
    }
  }
  const line = (x0: number, y0: number, x1: number, y1: number, color: number) => {
    const length = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let step = 0; step <= length; step++) pixel(Math.round(x0 + (x1 - x0) * step / length),
      Math.round(y0 + (y1 - y0) * step / length), color)
  }
  return { width, height, pixels, pixel, rectangle, ellipse, polygon, line }
}

function png(art: ReturnType<typeof image>) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(art.width)
  header.writeUInt32BE(art.height, 4)
  header[8] = 8; header[9] = 6
  const rows = Buffer.alloc((art.width * 4 + 1) * art.height)
  for (let y = 0; y < art.height; y++) for (let x = 0; x < art.width; x++) {
    const color = RGBA[art.pixels[y * art.width + x]]
    for (let channel = 0; channel < 4; channel++) rows[y * (art.width * 4 + 1) + 1 + x * 4 + channel] = color[channel]
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header), pngChunk('IDAT', zlib.deflateSync(rows, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))])
}

function atlas(frames: number, width: number, height: number, center: readonly [number, number], key: string) {
  return { frames: Object.fromEntries(Array.from({ length: frames }, (_, index) => [`${key}/${index}`, {
    frame: { x: index * width, y: 0, w: width, h: height }, center: { x: center[0], y: center[1] },
    sourceSize: { w: width, h: height }, trimmed: false,
  }])) }
}

function makeFloor() {
  const art = image(78 * 2, 40)
  for (let index = 0; index < 2; index++) {
    const x = index * 78
    art.polygon([[x + 39, 0], [x + 78, 20], [x + 39, 40], [x, 20]], index ? 4 : 3)
    art.line(x + 39, 0, x + 77, 20, 6)
    art.line(x + 1, 20, x + 39, 0, 5)
    art.line(x + 1, 21, x + 38, 39, 2)
    art.line(x + 40, 39, x + 77, 21, 2)
    art.line(x + 20, 10, x + 57, 29, index ? 5 : 4)
    art.line(x + 20, 29, x + 57, 10, index ? 5 : 4)
  }
  return png(art)
}

function makeBox() {
  const art = image(64, 64)
  art.ellipse(32, 49, 27, 10, 1)
  art.polygon([[8, 26], [33, 13], [57, 26], [32, 40]], 8)
  art.polygon([[8, 26], [32, 40], [32, 55], [8, 41]], 9)
  art.polygon([[32, 40], [57, 26], [57, 41], [32, 55]], 10)
  art.line(8, 26, 32, 40, 15); art.line(32, 40, 57, 26, 15)
  art.line(20, 20, 44, 33, 10); art.line(43, 19, 19, 33, 10)
  art.rectangle(29, 39, 7, 9, 1); art.rectangle(31, 41, 3, 4, 7)
  return png(art)
}

function makePebble() {
  const art = image(32, 24)
  art.ellipse(16, 18, 12, 4, 1)
  art.polygon([[6, 14], [10, 7], [21, 5], [27, 11], [25, 17], [14, 20]], 5)
  art.polygon([[6, 14], [10, 7], [21, 5], [20, 12], [14, 16]], 7)
  art.polygon([[21, 5], [27, 11], [25, 17], [20, 12]], 6)
  art.line(10, 8, 19, 6, 15)
  art.line(8, 14, 14, 17, 6)
  return png(art)
}

function makeBallast() {
  const art = image(40, 32)
  art.ellipse(20, 25, 17, 5, 1)
  art.polygon([[5, 13], [18, 6], [35, 12], [21, 21]], 7)
  art.polygon([[5, 13], [21, 21], [21, 28], [5, 20]], 4)
  art.polygon([[21, 21], [35, 12], [35, 20], [21, 28]], 3)
  art.line(6, 13, 18, 7, 15)
  art.line(12, 12, 27, 17, 9)
  art.line(15, 10, 30, 15, 8)
  return png(art)
}

function makeActor(direction: string, walking: boolean, guide = false) {
  const frames = walking ? 4 : 1
  const art = image(48 * frames, 76)
  for (let frame = 0; frame < frames; frame++) {
    const x = frame * 48, stride = walking ? [0, 4, 0, -4][frame] : 0
    art.ellipse(x + 24, 68, 18, 5, 1)
    art.rectangle(x + 15 + stride, 56, 8, 12, 1)
    art.rectangle(x + 25 - stride, 56, 8, 12, 1)
    art.rectangle(x + 13 + stride, 65, 11, 4, 10)
    art.rectangle(x + 25 - stride, 65, 11, 4, 10)
    art.polygon([[x + 12, 32], [x + 32, 29], [x + 39, 55], [x + 11, 59]], guide ? 8 : 14)
    art.polygon([[x + 23, 31], [x + 32, 29], [x + 39, 55], [x + 25, 57]], guide ? 9 : 12)
    art.line(x + 24, 36, x + 25, 54, guide ? 15 : 8)
    art.rectangle(x + 12, 50, 24, 4, 10)
    art.rectangle(x + 23, 50, 5, 4, 8)
    art.polygon([[x + 12, 33], [x + 7, 41], [x + 9, 54], [x + 15, 53]], guide ? 9 : 12)
    art.polygon([[x + 33, 32], [x + 41, 40], [x + 39, 53], [x + 33, 53]], guide ? 8 : 14)
    art.ellipse(x + 24, 23, 9, 11, 8)
    art.ellipse(x + 24, 16, 11, 4, 10)
    art.rectangle(x + 15, 15, 18, 6, guide ? 3 : 9)
    const faceX = x + 24 + (direction.includes('East') ? 4 : direction.includes('West') ? -4 : 0)
    if (!direction.startsWith('North')) {
      art.pixel(faceX - 3, 23, 1); art.pixel(faceX + 3, 23, 1)
      art.line(faceX - 2, 29, faceX + 2, 29, 10)
    } else art.rectangle(x + 16, 20, 16, 7, 10)
  }
  return png(art)
}

function makeDoor() {
  const art = image(80 * 7, 104)
  for (let frame = 0; frame < 7; frame++) {
    const x = frame * 80
    art.ellipse(x + 40, 88, 35, 9, 1)
    art.rectangle(x + 10, 15, 9, 73, 4)
    art.rectangle(x + 61, 15, 9, 73, 3)
    art.rectangle(x + 10, 11, 60, 10, 5)
    art.rectangle(x + 12, 14, 56, 3, 7)
    const right = x + 61 - frame * 6
    art.polygon([[x + 20, 22], [right, 22 + frame * 2], [right, 85 - frame * 2], [x + 20, 85]], 9)
    art.line(x + 21, 23, right, 23 + frame * 2, 8)
    if (frame < 6) {
      art.line(x + 30, 24, x + 30 - frame, 84, 10)
      art.line(x + 45 - frame * 3, 25, x + 45 - frame * 3, 83, 10)
      art.ellipse(right - 7, 57, 2, 3, 15)
    }
  }
  return png(art)
}

function zip(entries: readonly (readonly [string, Buffer])[]) {
  const bodies = [], directory = []
  let offset = 0
  for (const [filename, bytes] of entries) {
    const name = Buffer.from(filename), compressed = zlib.deflateRawSync(bytes, { level: 9 })
    const checksum = crc32(bytes), local = Buffer.alloc(30), central = Buffer.alloc(46)
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6)
    local.writeUInt16LE(8, 8); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26)
    bodies.push(local, name, compressed)
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42)
    directory.push(central, name)
    offset += local.length + name.length + compressed.length
  }
  const index = Buffer.concat(directory), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...bodies, index, end])
}

function buildFiles() {
  const files = new Map<string, Buffer>()
  const json = (name: string, data: unknown) => files.set(name, Buffer.from(`${JSON.stringify(data, null, 2)}\n`))
  const visual = (current: object) => ({ classes: { current }, render: { flags: [] } })
  const base = (type: string, prototype: number, flags: string[] = []) => ({ type, prototype, flags, location: [0, 0], offset: [0, 0] })
  const critterVisual = { type: 'Critter', race: 'Workshop', gender: 'Male', armor: 'Coat',
    shield: 'None', weapon: 'Unarmed', animation: 'Stand', stage: 'South', frame: 0 }
  json('Prototypes/Pc/900001.json', { Base: base('Pc', 900001),
    Critter: { flags: [], inventoryIndex: 0, inventorySource: 0 }, Visual: visual(critterVisual) })
  json('Prototypes/Container/900002.json', { Base: base('Container', 900002),
    Container: { flags: ['NeverLocked'], inventoryIndex: 0, inventorySource: 0, lockDifficulty: 0, keyId: 0 },
    Visual: visual({ type: 'Container', category: 'Workshop', name: 'Box', stage: 'North', frame: 0 }) })
  json('Prototypes/Generic/900003.json', { Base: { ...base('Generic', 900003, ['Inventory', 'NoBlock']), descIndex: 9003 },
    Item: { flags: [], weight: 1, worth: 0, invLocation: 0, magicTechComplexity: 0 } })
  json('mes/Description.json', { Description: [
    { id: '9003', text: TOKEN_LABEL }, { id: '9006', text: PRIZE_LABEL },
    { id: '9007', text: GROUND_ITEM_LABEL }, { id: '9009', text: BALLAST_LABEL },
  ] })
  json('Prototypes/Portal/900004.json', { Base: base('Portal', 900004),
    Portal: { flags: ['NeverLocked'], keyID: 0, lockDifficulty: 0 },
    Visual: visual({ type: 'Portal', category: 'Door', name: 'Workshop', version: 0, side: 6, stage: 'North', frame: 0 }) })
  json('Prototypes/Key/900005.json', { Base: base('Key', 900005, ['Inventory', 'NoBlock']),
    Item: { flags: [], weight: 1, worth: 0, invLocation: 0, magicTechComplexity: 0 },
    Key: { keyId: LOCK_KEY_ID } })
  json('Prototypes/Generic/900006.json', { Base: { ...base('Generic', 900006, ['Inventory', 'NoBlock']), descIndex: 9006 },
    Item: { flags: [], weight: 1, worth: 0, invLocation: 0, magicTechComplexity: 0 } })
  json('Prototypes/Generic/900007.json', { Base: { ...base('Generic', 900007, ['NoBlock']), descIndex: 9007 },
    Item: { flags: [], weight: 1, worth: 0, invLocation: 0, magicTechComplexity: 0,
      groundTransferSupported: true },
    Visual: visual({ type: 'Item', category: 'Workshop', subcat: 'Base', number: 0,
      display: 'Ground', stage: 'North', frame: 0 }) })
  json('Prototypes/Npc/900008.json', { Base: base('Npc', 900008),
    Critter: { flags: [], inventoryIndex: 0, inventorySource: 0 },
    Npc: { flags: [], waypoints: [], conversationSupported: true, conversationId: CONVERSATION_ID },
    Visual: visual({ ...critterVisual, race: 'WorkshopGuide' }) })
  json('Prototypes/Generic/900009.json', { Base: { ...base('Generic', 900009, ['Inventory', 'NoBlock']), descIndex: 9009 },
    Item: { flags: [], weight: BALLAST_WEIGHT, worth: 0, invLocation: 0, magicTechComplexity: 0,
      groundTransferSupported: true },
    Visual: visual({ type: 'Item', category: 'Workshop', subcat: 'Base', number: 1,
      display: 'Ground', stage: 'North', frame: 0 }) })
  json('16086.json', { Base: { prototype: 900001, location: [4, 4] },
    Critter: { inventory: [], inventoryIndex: 0, inventorySource: 0, progressionSupported: true } })
  json('rules/Progression.json', { version: 2, actorId: '16086.json', profile: 'neutral-human',
    baseline: { ...PROGRESSION_BASELINE, attributes: { ...PROGRESSION_BASELINE.attributes } } })
  json(`${MAP_ID}/Map.json`, { width: 1, height: 1, startLocation: [4, 4] })
  const tiles = Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => ({})))
  for (let x = 1; x <= 12; x++) for (let y = 1; y <= 10; y++) {
    tiles[x][y] = { type: 'Tile', start: { category: 'Workshop', version: (x + y) % 2 },
      end: { category: 'Workshop', version: 0 }, stage: 'North', outdoor: true }
  }
  json(`${PREFIX}/Sector.json`, { tiles, lights: [], roof: [] })
  json(BOX_ID, { Base: { prototype: 900002, location: [6, 4] },
    Container: { inventory: [{ id: TOKEN_ID, slot: 3 }], inventoryIndex: 1 } })
  json(TOKEN_ID, { Base: { prototype: 900003, location: [6, 4] }, Item: { parent: BOX_ID, invLocation: 7 } })
  json(DOOR_ID, { Base: { prototype: 900004, location: [8, 4] } })
  json(SCRIPTED_DOOR_ID, { Base: { prototype: 900004, location: [11, 5] } })
  json('rules/ScriptModule.json', { format: 'openarcanum-script-module', version: 1, manifest: 'scripts/manifest.json' })
  json('rules/ScriptBindings.json', { format: 'openarcanum-script-bindings', version: 1, objects: {
    [SCRIPTED_DOOR_ID]: { 1: { scriptId: 'workshop:door', flags: 0, counters: [0, 0, 0, 0] } }
  } })
  json(KEY_BOX_ID, { Base: { prototype: 900002, location: [3, 7] },
    Container: { inventory: [{ id: KEY_ID, slot: 3 }], inventoryIndex: 1 } })
  json(KEY_ID, { Base: { prototype: 900005, location: [3, 7] },
    Item: { parent: KEY_BOX_ID, invLocation: 0 } })
  json(LOCKED_DOOR_ID, { Base: { prototype: 900004, location: [10, 6] },
    Portal: { flags: ['Locked'], keyID: LOCK_KEY_ID, keyUseSupported: true } })
  json(LOCKED_BOX_ID, { Base: { prototype: 900002, location: [6, 8] },
    Container: { flags: ['Locked'], keyId: LOCK_KEY_ID, keyUseSupported: true,
      inventory: [{ id: PRIZE_ID, slot: 3 }], inventoryIndex: 1 } })
  json(PRIZE_ID, { Base: { prototype: 900006, location: [6, 8] },
    Item: { parent: LOCKED_BOX_ID, invLocation: 0 } })
  json(GROUND_ITEM_ID, { Base: { prototype: 900007, location: [4, 7] },
    Item: { parent: null, invLocation: 0 } })
  json(BALLAST_BOX_ID, { Base: { prototype: 900002, location: [11, 2] },
    Container: { inventory: [{ id: BALLAST_ID, slot: 3 }], inventoryIndex: 1 } })
  json(BALLAST_ID, { Base: { prototype: 900009, location: [11, 2] },
    Item: { parent: BALLAST_BOX_ID, invLocation: 0 } })
  json(NPC_ID, { Base: { prototype: 900008, location: [9, 8] } })
  json('rules/Conversations.json', { version: 1,
    quests: [{ id: QUEST_ID, title: QUEST_TITLE, rewardExperience: QUEST_EXPERIENCE_REWARD,
      activeText: 'Find the loose workshop pebble and show it to the guide while carrying it.',
      completedText: 'The guide examined the pebble. It remains yours.' }],
    conversations: [{ id: CONVERSATION_ID, targetId: NPC_ID, label: NPC_LABEL, questId: QUEST_ID,
      nodes: [
        { id: 'offer', text: 'I am checking the workshop samples. Will you find the loose pebble and bring it over for a closer look?',
          options: [{ id: 'accept', text: 'I will find the pebble.', effect: 'start' },
            { id: 'leave', text: 'Not now.', effect: 'close' }] },
        { id: 'active', text: 'Have you found the workshop pebble? Carry it here so I can examine it. You can keep it.',
          options: [{ id: 'show', text: 'Here is the workshop pebble.', effect: 'complete',
            condition: { kind: 'held-item', itemId: GROUND_ITEM_ID } },
          { id: 'leave', text: 'I will come back.', effect: 'close' }] },
        { id: 'completed', text: 'That is the sample I needed to see. Thank you; keep the pebble.',
          options: [{ id: 'leave', text: 'Goodbye.', effect: 'close' }] },
      ] }],
  })
  files.set('Gfx/2D/Tile/tiles.png', makeFloor())
  json('Gfx/2D/Tile/tiles.json', { frames: Object.fromEntries([0, 1].map(index => [
    `Tile/Workshop/Workshop/${index}/0/0/North/Sprite.gif`, {
      frame: { x: index * 78, y: 0, w: 78, h: 40 }, center: { x: 39, y: 39 }, trimmed: false,
    }])) })
  const sprite = (name: string, bytes: Buffer, frames: number, width: number, height: number, center: readonly [number, number], animated = false) => {
    json(`Gfx/2D/${name}/Meta.json`, { frameRate: animated ? 5 : 1, animated, imageExtension: 'png' })
    files.set(`Gfx/2D/${name}/0/North/Sprite.png`, bytes)
    json(`Gfx/2D/${name}/0/North/Stage.json`, atlas(frames, width, height, center, `${name}/0/North`))
  }
  sprite('Container/Workshop/Box', makeBox(), 1, 64, 64, [32, 48])
  sprite('Portal/Door/Workshop/0', makeDoor(), 7, 80, 104, [40, 88])
  sprite('Item/Workshop/Base/0/Ground', makePebble(), 1, 32, 24, [16, 19])
  sprite('Item/Workshop/Base/1/Ground', makeBallast(), 1, 40, 32, [20, 26])
  for (const animation of ['Stand', 'Walk']) {
    const name = `Critter/Workshop/Male/Coat/None/Unarmed/${animation}`
    json(`Gfx/2D/${name}/Meta.json`, { frameRate: 5, animated: animation === 'Walk', imageExtension: 'png' })
    for (const direction of DIRECTIONS) {
      files.set(`Gfx/2D/${name}/0/${direction}/Sprite.png`, makeActor(direction, animation === 'Walk'))
      json(`Gfx/2D/${name}/0/${direction}/Stage.json`, atlas(animation === 'Walk' ? 4 : 1,
        48, 76, [24, 68], `${name}/0/${direction}`))
    }
  }
  const guideName = 'Critter/WorkshopGuide/Male/Coat/None/Unarmed/Stand'
  json(`Gfx/2D/${guideName}/Meta.json`, { frameRate: 1, animated: false, imageExtension: 'png' })
  for (const direction of DIRECTIONS) {
    files.set(`Gfx/2D/${guideName}/0/${direction}/Sprite.png`, makeActor(direction, false, true))
    json(`Gfx/2D/${guideName}/0/${direction}/Stage.json`, atlas(1, 48, 76, [24, 68], `${guideName}/0/${direction}`))
  }
  const sorted = [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  for (const [archive, prefix] of [['Prototypes.zip', 'Prototypes/'], [`${MAP_ID}.zip`, `${MAP_ID}/`], ['Gfx.zip', 'Gfx/']]) {
    files.set(`archives/${archive}`, zip(sorted.filter(([name]) => name.startsWith(prefix))))
  }
  return files
}

function manifest(files: Map<string, Buffer>) {
  return { format: 'openarcanum-owned-module', version: 1, id: 'inventory-workshop', name: MAP_ID,
    mapId: MAP_ID, license: 'GPL-3.0-or-later', data: 'data', spawn: [4, 4],
    files: [...files.keys()].sort() }
}

async function generate(directory = __dirname) {
  const files = buildFiles()
  for (const [name, bytes] of files) {
    const filename = path.join(directory, 'data', name)
    await fs.mkdir(path.dirname(filename), { recursive: true })
    await fs.writeFile(filename, bytes)
  }
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, 'module.json'), `${JSON.stringify(manifest(files), null, 2)}\n`)
  // External runnable fixtures need the checked TypeScript build as well as
  // deterministic source data. Compiled modules are deliberately absent from
  // buildFiles()/module.json and are never checked into the repository.
  if (path.resolve(directory) !== path.resolve(__dirname)) {
    await fs.cp(path.join(__dirname, 'data/scripts'), path.join(directory, 'data/scripts'), { recursive: true })
  }
  return { directory, files: files.size, mapId: MAP_ID }
}

module.exports = { buildFiles, manifest, generate, MAP_ID, BOX_ID, TOKEN_ID, TOKEN_LABEL, DOOR_ID, SCRIPTED_DOOR_ID,
  KEY_BOX_ID, KEY_ID, LOCKED_DOOR_ID, LOCK_KEY_ID, LOCKED_BOX_ID, PRIZE_ID, PRIZE_LABEL,
  GROUND_ITEM_ID, GROUND_ITEM_LABEL, NPC_ID, NPC_LABEL, CONVERSATION_ID, QUEST_ID, QUEST_TITLE,
  QUEST_EXPERIENCE_REWARD, PROGRESSION_BASELINE, DIRECTIONS, BALLAST_BOX_ID, BALLAST_ID, BALLAST_LABEL, BALLAST_WEIGHT }
if (require.main === module) generate().then(result => console.log(JSON.stringify(result)))
  .catch(error => { console.error(error.message); process.exitCode = 1 })

export type WorkshopGenerator = typeof generate
export type WorkshopFiles = ReturnType<typeof buildFiles>
