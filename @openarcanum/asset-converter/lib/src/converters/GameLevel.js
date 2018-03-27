
const readline = require('readline');
const fs = require('fs');


// copy pasted from comments in file
const namesDict = [
    {name: 'Stats', value: 'st, dx, cn, be, in, pe, wp, ch'.split(', ')},
    {name: 'Skills', value: 'bow, dodge, melee, throwing, backstab, pickpocket, prowling, spottrap, gambling, haggle, heal, persuasion, repair, firearms, picklock, armtrap'.split(', ')},
    {name: 'Spells', value: 'conveyance, divination, air, earth, fire, water, force, mental, meta, morph, nature, necro_evil, necro_good, phantasm, summoning, temporal'.split(', ')},
    {name: 'Tech', value: 'anatomical, chemistry, electric, explosives, gun_smithy, mechanical, smithy, therapeutics'.split(', ')},
    {name: 'Misc', value: 'maxhps, maxfatigue'.split(', ')}
]

const statsDict = {
    'st': 'Strength',
    'cn': 'Constitution',
    'dx': 'Dexterity',
    'be': 'Beauty',
    'in': 'Intelligence',
    'wp': 'Willpower',
    'pe': 'Perception',
    'ch': 'Charisma'
}


const parseGamelevel = (line) => {
    let re = /^\{([^\}]+)\}([^\{]+)\{([^\}]+)\}/
    let val = line.match(re);
    let gamelevel = {
        'id': val[1],
        'name': val[2].trim(),
        'orig': val,
        'advance': Array()
    }

    if(gamelevel.name.indexOf('-')==0) {
        gamelevel.type = 'random'
        gamelevel.name = gamelevel.name.substring(1)
    }else{
        gamelevel.type = 'named'
    }
    let rawStats = val[3].split(', ')
    rawStats.forEach(function(item, index, array) {
        let re = /(\w+)\s+(\d+)/
        let vars = item.match(re);
        if( vars === null) {
            throw new SyntaxError('failed to parse skill string')
        }
        let found = namesDict.find(stat => stat.value.includes(vars[1].toLowerCase()))
        if (found === undefined) {
            found = Object({'name': 'Misc'})
        }
        let properName = null
        if(found.name == 'Stats'){
            properName = statsDict[vars[1]]
        } else {
            properName = vars[1].replace(/_([a-z])/g, function (g) { return g[1].toUpperCase(); })
            properName = properName[0].toUpperCase() + properName.substring(1)
        }
        gamelevel['advance'].push({level:(index+1), symbol:vars[1], name:properName, value:vars[2], type:found.name})
    });
    

    return gamelevel
}


const rl = readline.createInterface({
  input: fs.createReadStream('gamelevel.mes'),
  crlfDelay: Infinity
});

rl.on('line', (line) => {
    if (line != "" && !line.startsWith('//')) {
        console.log(`Line from file: ${line}`);
        console.log(JSON.stringify(parseGamelevel(line)))
    }
});


