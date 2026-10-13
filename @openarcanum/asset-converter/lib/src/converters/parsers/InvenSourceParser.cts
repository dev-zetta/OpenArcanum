import readline = require('node:readline');
import fs = require('node:fs');
interface Shop { id: string; name: string; sells: {chance: string; prototype_id: string}[]; buys?: {prototype_id: string}[] }
interface Purchases { id: string; name: string; buys: {prototype_id: string}[] }

function parseInvenSource(line: string): Shop {
  const val = line.match(/^\{([^\}]+)\}\{([^\:]+)\:([^\}]+)\}/);
  if (!val) throw new SyntaxError('Invalid inventory source record');
  const item: Shop = { id: val[1], name: val[2], sells: [] };
  const re = /\s?([\-\d]+)\,(\d+)\s|$/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(val[3]))) {
    if (match[0] === '') break;
    item.sells.push({ chance: match[1], prototype_id: match[2] });
  }
  return item;
}

function parseInvenSourceBuy(line: string): Purchases {
  const val = line.match(/^\{([^\}]+)\}([^\:]+)\:\s*(0\,0)*\{([^\}]*)\}/);
  if (!val) throw new SyntaxError('Invalid inventory purchase record');
  const item: Purchases = { id: val[1], name: val[2], buys: [] };
  if (val[4] !== '') val[4].split(' ').forEach(prototype_id => item.buys.push({ prototype_id }));
  return item;
}

if (require.main === module) {
  const shops: { [id: string]: Shop } = {};
  const input = readline.createInterface({ input: fs.createReadStream('InvenSource.mes'), crlfDelay: Infinity });
  input.on('line', line => {
    if (line.startsWith('{')) { const item = parseInvenSource(line); shops[item.id] = item; }
  }).on('close', () => {
    const purchases = readline.createInterface({ input: fs.createReadStream('InvenSourceBuy.mes'), crlfDelay: Infinity });
    purchases.on('line', line => {
      if (!line.startsWith('{')) return;
      const item = parseInvenSourceBuy(line);
      if (Object.hasOwn(shops, item.id)) shops[item.id].buys = item.buys;
      else console.log(line, item);
    }).on('close', () => console.log(shops));
  });
}
export = { parseInvenSource, parseInvenSourceBuy };
