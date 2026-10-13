const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const { test } = require('node:test') as typeof import('node:test')
const fs = require('node:fs') as typeof import('node:fs')
const os = require('node:os') as typeof import('node:os')
const path = require('node:path') as typeof import('node:path')
const iconv = require('iconv-lite') as typeof import('iconv-lite')
const reader = require('../../dist/src/helpers/ReaderHelper.cjs') as typeof import("../../dist/src/helpers/ReaderHelper.cjs")

test('converter entry point loads without running conversion', () => {
  assert.equal(typeof (require('../../dist/index.cjs') as typeof import('../index.cjs')).executor.start, 'function')
})

test('record reader preserves Windows-1251 text, comments, and multiline values', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openarcanum-converter-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const filename = path.join(dir, 'synthetic.mes')
  fs.writeFileSync(filename, iconv.encode('{100}{Привет} // greeting\n{101}{first\nsecond}\n{102}{last}', 'win1251'))
  const records = reader.readRecords(filename)
  assert.equal(records.length, 3)
  assert.deepEqual({ ...records[0] }, { key: 100, value: 'Привет', comment: 'greeting' })
  assert.equal(records[1].value, 'first\nsecond')
  assert.deepEqual(reader.fetchRecordsForRange(records, 100, 101).map(record => record.key), [100, 101])
})

const levels = require('../../dist/src/converters/parsers/GameLevelParser.cjs') as typeof import("../../dist/src/converters/parsers/GameLevelParser.cjs")
const inventory = require('../../dist/src/converters/parsers/InvenSourceParser.cjs') as typeof import("../../dist/src/converters/parsers/InvenSourceParser.cjs")

test('standalone level parser preserves ordered stats, skills and random names without starting file I/O', () => {
  const value = levels.parseGamelevel('{7}- Soldier{st 2, melee 3, gun_smithy 1}')
  assert.equal(value.type, 'random')
  assert.equal(value.name, ' Soldier')
  assert.deepEqual(value.advance, [
    { level: 1, symbol: 'st', name: 'Strength', value: '2', type: 'Stats' },
    { level: 2, symbol: 'melee', name: 'Melee', value: '3', type: 'Skills' },
    { level: 3, symbol: 'gun_smithy', name: 'GunSmithy', value: '1', type: 'Tech' }
  ])
  assert.throws(() => levels.parseGamelevel('bad record'), SyntaxError)
})

test('standalone inventory parser preserves seller chances and buyer prototype lists', () => {
  assert.deepEqual(inventory.parseInvenSource('{4}{Smith: 80,1001 20,1002 }'), {
    id: '4', name: 'Smith', sells: [
      { chance: '80', prototype_id: '1001' }, { chance: '20', prototype_id: '1002' }
    ]
  })
  assert.deepEqual(inventory.parseInvenSourceBuy('{4}Smith: 0,0{1001 1002}'), {
    id: '4', name: 'Smith', buys: [{ prototype_id: '1001' }, { prototype_id: '1002' }]
  })
  assert.throws(() => inventory.parseInvenSource('bad record'), SyntaxError)
  assert.throws(() => inventory.parseInvenSourceBuy('bad record'), SyntaxError)
})
