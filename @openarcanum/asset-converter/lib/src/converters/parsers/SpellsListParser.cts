import readerHelper = require('../../helpers/ReaderHelper.cjs');
import Spell = require('../../classes/Spell.cjs');

const spells = new Map<string, string>();
spells.set('Disarm', 'disarm');
spells.set('Unlocking Cantrip', 'unlockingCantrip');
spells.set('Unseen Force', 'unseenForce');
spells.set('Spatial Distortion', 'spatialDistortion');
spells.set('Teleportation', 'teleportation');
spells.set('Sense Alignment', 'senseAlignment');
spells.set('See Contents', 'seeContents');
spells.set('Sense Aura', 'senseAura');
spells.set('Sense Hidden', 'senseHidden');
spells.set('Divine Magic', 'divineMagic');
spells.set('Vitality of Air', 'vitalityOfAir');
spells.set('Poison Vapours', 'poisonVapours');
spells.set('Call Winds', 'callWinds');
spells.set('Body of Air', 'bodyOfAir');
spells.set('Call Air Elemental', 'callAirElemental');
spells.set('Strength of Earth', 'strengthOfEarth');
spells.set('Stone Throw', 'stoneThrow');
spells.set('Wall of Stone', 'wallOfStone');
spells.set('Body of Stone', 'bodyOfStone');
spells.set('Call Earth Elemental', 'callEarthElemental');
spells.set('Agility of Fire', 'agilityOfFire');
spells.set('Wall of Fire', 'wallOfFire');
spells.set('Fireflash', 'firelash');
spells.set('Body of Fire', 'bodyOfFire');
spells.set('Call Fire Elemental', 'callFireElemental');
spells.set('Purity of Water', 'purityOfWater');
spells.set('Call Fog', 'callFog');
spells.set('Squall of Ice', 'squallOfIce');
spells.set('Body of Water', 'bodyOfWater');
spells.set('Call Water Elemental', 'callWaterElemental');
spells.set('Shield of Protection', 'shieldOfProtection');
spells.set('Jolt', 'jolt');
spells.set('Wall of Force', 'wallOfForce');
spells.set('Bolt of Lightning', 'boltOfLighting');
spells.set('Disintegrate', 'disintegrate');
spells.set('Charm', 'charm');
spells.set('Stun', 'stun');
spells.set('Drain Will (WAS Stupefy)', 'drainWill');
spells.set('Nightmare', 'nightmare');
spells.set('Dominate Will', 'dominateWill');
spells.set('Resist Magic', 'resistMagic');
spells.set('Disperse Magic', 'disperseMagic');
spells.set('Dweomer Shield', 'dweomerShield');
spells.set('Bonds of Magick', 'bondsOfMagick');
spells.set('Reflection Shield', 'reflectionShield');
spells.set('Hardened Hands', 'hardenedHands');
spells.set('Weaken', 'weaken');
spells.set('Shrink', 'shrink');
spells.set('Flesh to Stone', 'fleshToStone');
spells.set('Polymorph Other', 'polymorphOther');
spells.set('Charm Beast', 'charmBeast');
spells.set('Entangle', 'entangle');
spells.set('Control Beast', 'controlBeast');
spells.set('Succor Beast', 'succorBeast');
spells.set('Regenerate', 'regenerate');
spells.set('Harm', 'harm');
spells.set('Conjure Spirit', 'conjureSpirit');
spells.set('Summon Undead', 'summonUndead');
spells.set('Create Undead', 'createUndead');
spells.set('Quench Life', 'quenchLife');
spells.set('Minor Healing', 'mirrorHealing');
spells.set('Halt Poison', 'haltPoison');
spells.set('Major Healing', 'majorHealing');
spells.set('Sanctuary', 'sanctuary');
spells.set('Ressurrect', 'ressurrect');
spells.set('Illuminate', 'illuminate');
spells.set('Flash', 'flash');
spells.set('Blur Sight', 'blurSight');
spells.set('Phantasmal Fiend', 'phantasmalFiend');
spells.set('Invisibility', 'invisibility');
spells.set('Plague of Insects', 'plagueOfInsects');
spells.set('Orcish Champion', 'orcishChampion');
spells.set('Guardian Ogre', 'guardianOgre');
spells.set('Hellgate', 'hellgate');
spells.set('Familiar', 'familiar');
spells.set('Magelock', 'magelock');
spells.set('Congeal Time', 'congealTime');
spells.set('Hasten', 'hasten');
spells.set('Stasis', 'stasis');
spells.set('Tempus Fugit', 'tempusFugit');

const colleges = new Map<string, string>();
colleges.set('Conveyance', 'conveyance');
colleges.set('Divination', 'divination');
colleges.set('Air', 'air');
colleges.set('Earth', 'earth');
colleges.set('Fire', 'fire');
colleges.set('Water', 'water');
colleges.set('Force', 'force');
colleges.set('Mental', 'mental');
colleges.set('Meta', 'meta');
colleges.set('Morph', 'morph');
colleges.set('Nature', 'nature');
colleges.set('Necromantic (Evil)', 'necromanticEvil');
colleges.set('Necromantic (Good)', 'necromanticGood');
colleges.set('Phantasm', 'phantasm');
colleges.set('Summon', 'summon');
colleges.set('Temporal', 'temporal');

//* ************
// GENERATORS
//* ************
export = {
  parseSpells: function(file: string, inputFolder: string) {
    return parseSpells(inputFolder + file + '.mes');
  }
};

function parseSpells(filePath: string) {
  const data = readerHelper.readFile(filePath);
  const records = readerHelper.readRecords(filePath);
  if (data === null) {
    return null;
  }
  return prepareSpells(records);
}

// *********
// HELPERS
// *********

function prepareSpells(data: import("../../classes/Record.cjs")[]) {
  const messageTypes: { [college: string]: { [spell: string]: Spell } } = {};
  const spellNames = Array.from(spells.keys());
  const collegeNames = Array.from(colleges.keys());
  for (let i = 0; i < collegeNames.length; ++i) {
    const collegeName = colleges.get(collegeNames[i])!;
    messageTypes[collegeName] = {};
    for (let j = 0; j < 5; ++j) {
      const spellName = spellNames[i * 5 + j];
      const startAt = 1000 + (i * 5 + j) * 50;
      const endAt = startAt + 49;
      const spellRecords = readerHelper.fetchRecordsForRange(data, startAt, endAt);
      messageTypes[collegeName][spells.get(spellName)!] = new Spell(spellName, spellRecords, startAt);
    }
  }
  return messageTypes;
}
