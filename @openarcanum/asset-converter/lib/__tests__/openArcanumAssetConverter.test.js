const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const iconv = require('iconv-lite')
const reader = require('../src/helpers/ReaderHelper.js')

test('converter entry point loads without running conversion', () => {
  assert.equal(typeof require('../index.js').executor.start, 'function')
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
