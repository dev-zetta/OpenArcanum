import readline = require('readline');
import fs = require('fs');


// Copy pasted from comments in file
const namesDict = [
  { name: 'Stats', value: 'st, dx, cn, be, in, pe, wp, ch'.split(', ') },
  {
    name: 'Skills',
    value: 'bow, dodge, melee, throwing, backstab, pickpocket, prowling, spottrap, gambling, haggle, heal, persuasion, repair, firearms, picklock, armtrap'.split(
      ', '
    )
  },
  {
    name: 'Spells',
    value: 'conveyance, divination, air, earth, fire, water, force, mental, meta, morph, nature, necro_evil, necro_good, phantasm, summoning, temporal'.split(
      ', '
    )
  },
  {
    name: 'Tech',
    value: 'anatomical, chemistry, electric, explosives, gun_smithy, mechanical, smithy, therapeutics'.split(
      ', '
    )
  },
  { name: 'Misc', value: 'maxhps, maxfatigue'.split(', ') }
];

const statsDict: { [symbol: string]: string | undefined } = {
  st: 'Strength', cn: 'Constitution', dx: 'Dexterity', be: 'Beauty',
  in: 'Intelligence', wp: 'Willpower', pe: 'Perception', ch: 'Charisma'
};

interface Advancement { level: number; symbol: string; name: string; value: string; type: string }
interface GameLevel { id: string; name: string; orig: RegExpMatchArray; advance: Advancement[]; type: 'random' | 'named' }
function parseGamelevel(line: string): GameLevel {
  const val = line.match(/^\{([^\}]+)\}([^\{]+)\{([^\}]+)\}/);
  if (!val) throw new SyntaxError('Invalid game level record');
  const name = val[2].trim();
  const gamelevel: GameLevel = { id: val[1], name: name.startsWith('-') ? name.substring(1) : name,
    orig: val, advance: [], type: name.startsWith('-') ? 'random' : 'named' };
  val[3].split(', ').forEach((item, index) => {
    const vars = item.match(/(\w+)\s+(\d+)/);
    if (!vars) throw new SyntaxError('failed to parse skill string');
    const found = namesDict.find(stat => stat.value.includes(vars[1].toLowerCase())) || { name: 'Misc' };
    let properName = found.name === 'Stats' ? statsDict[vars[1]] : vars[1].replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
    if (!properName) throw new SyntaxError('Unknown stat symbol');
    properName = properName[0].toUpperCase() + properName.substring(1);
    gamelevel.advance.push({ level: index + 1, symbol: vars[1], name: properName, value: vars[2], type: found.name });
  });
  return gamelevel;
}

// Importing converter utilities never starts file I/O. Preserve the historical
// standalone command when this parser is executed explicitly.
if (require.main === module) {
  const rl = readline.createInterface({ input: fs.createReadStream('gamelevel.mes'), crlfDelay: Infinity });
  rl.on('line', line => {
    if (line !== '' && !line.startsWith('//')) {
      console.log(`Line from file: ${line}`);
      console.log(JSON.stringify(parseGamelevel(line)));
    }
  });
}
export = { parseGamelevel };
