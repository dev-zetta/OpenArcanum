import type {Node} from '@babel/types'
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const {test} = require('node:test') as typeof import('node:test')
const fs = require('node:fs') as typeof import('node:fs')
const path = require('node:path') as typeof import('node:path')
const {Script} = require('node:vm') as typeof import('node:vm')
const {parse} = require('@babel/parser') as typeof import('@babel/parser')
const {VISITOR_KEYS} = require('@babel/types') as typeof import('@babel/types')

for (const name of fs.readdirSync(__dirname).filter(name => name.endsWith('-smoke.cts'))) {
  test(`${name} sends JavaScript syntax to the renderer`, () => {
    const ast = parse(fs.readFileSync(path.join(__dirname, name), 'utf8'), {
      sourceType: 'unambiguous', plugins: ['typescript']
    })
    let checked = 0
    function visit(node: Node): void {
      if (node.type === 'CallExpression' &&
          (node.callee.type === 'Identifier' && node.callee.name === 'evaluate' ||
           node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier' &&
           node.callee.property.name === 'executeJavaScript')) {
        const argument = node.arguments[0]
        // Interpolation values come from JSON.stringify or numeric constants;
        // null preserves the surrounding JavaScript syntax for this parse check.
        const source = argument?.type === 'TemplateLiteral'
          ? argument.quasis.map(part => part.value.cooked ?? part.value.raw).join('null')
          : argument?.type === 'StringLiteral' ? argument.value : undefined
        if (source !== undefined) {
          assert.doesNotThrow(() => new Script(source), `${name}:${argument!.loc?.start.line} contains invalid renderer JavaScript`)
          checked++
        }
      }
      for (const key of VISITOR_KEYS[node.type] || []) {
        const child = Reflect.get(node, key) as Node | Node[] | undefined
        if (Array.isArray(child)) child.forEach(visit)
        else if (child) visit(child)
      }
    }
    visit(ast.program)
    assert.ok(checked > 0, 'the smoke harness must contain checked renderer scripts')
  })
}
