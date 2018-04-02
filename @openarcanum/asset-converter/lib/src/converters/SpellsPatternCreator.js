const readerHelper = require('../helpers/ReaderHelper');
const dictionary = require('../resources/Dictionaries').generateDictionary();
const colleges = fetchColleges();
const spellsMap = fetchSpells();

//*************
// GENERATORS
//*************
module.exports = {
  generatePatternForSingleFile: function (file, inputFolder, outputFolder) {
    var generated = generatePatternForSingleFile(inputFolder + file + ".mes", file);
    readerHelper.writeJsonObjectToFile(generated, outputFolder + file + ".json");
  }
};

function generatePatternForSingleFile(filePath, file) {
  var data = readerHelper.readFile(filePath);
  var records = readerHelper.readRecords(filePath);
  if (data === null) {
    return null;
  }
  return prepareSpells(data);
}

// *********
// HELPERS
// *********

function prepareSpells(data) {
  var messageTypes = {};
  for (var i = 0; i < collegeNames.length; ++i) {
    messageTypes[colleges.get(collegeNames[i])] = {};
    for (var j = 0; j < 5; ++j) {
      messageTypes[colleges.get(collegeNames[i])][spellsMap.get(spells[i * 5 + j])] = {};
    }
  }
  return messageTypes;
}

function printOnlySpellHeaders(data) {
  var messageTypes = [];
  var messageTypesArray = data.match(/\/\/ (\d+) -- (.*)/gm);
  for (var i = 0; i < messageTypesArray.length; ++i) {
    var messageGroup = messageTypesArray[i].match(/\/\/ (\d+) -- (.*)/);
    console.log(messageGroup[2])
  }
  return messageTypes;
}

function printColleges(data) {
  var messageTypes = [];
  var messageTypesArray = data.match(/\/\/ College: \[(.*)] ------/gm);
  for (var i = 0; i < messageTypesArray.length; ++i) {
    var messageGroup = messageTypesArray[i].match(/\/\/ College: \[(.*)] ------/);
    console.log(messageGroup[1]);
  }
  return messageTypes;
}

function printDebugSpells(records) {
  var startAt = 1000;
  for (var i = 0; i < spells.length; ++i) {
    console.log(i + " -- " + spells[i]);
    printRecordsForRange(records, (startAt + i * 50), parseInt(startAt + i * 50) + 50);

  }
}

function printDebugItemOnly(records) {
  var startAt = 5000;
  for (var i = 0; i < itemOnly.length; ++i) {
    console.log((80 + i) + " -- " + itemOnly[i]);
    printRecordsForRange(records, (startAt + i * 50), parseInt(startAt + i * 50) + 50);
  }
}

function printDebugTechItemOnly(records) {
  var startAt = 10000;
  for (var i = 0; i < techItem.length; ++i) {
    console.log((i + 1) + " -- " + techItem[i]);
    printRecordsForRange(records, (startAt + i * 50), parseInt(startAt + i * 50) + 50);
  }
}

function printDebugItemOnlySecond(records) {
  var startAt = 13350;
  for (var i = 0; i < itemOnlySecondPart.length; ++i) {
    console.log((i + 1) + " -- " + itemOnlySecondPart[i]);
    printRecordsForRange(records, (startAt + i * 50), parseInt(startAt + i * 50) + 50);
  }
}

function printRecordsForRange(records, min, max) {
  for (var j = 0; j < records.length; ++j) {
    if (records[j].key >= max) {
      break;
    }
    if (records[j].key >= min) {
      console.log("  {" + records[j].key + "}: " + records[j].value)
    }
  }
}


function Spell() {
  this.name = "";
  this.castingEffect = "Instant";
  this.mantain = false;
  this.resist = false;
  this.range = "MaxVisible";
  this.minIq = 6;
  this.info = "Neutral";

  this.effects = [];
}

var spells = [
  "Disarm",
  "Unlocking Cantrip",
  "Unseen Force",
  // "Shadow Shift",
  "Spatial Distortion",
  "Teleportation",
  "Sense Alignment",
  "See Contents",
  // "Sense Traps",
  "Sense Aura",
  "Sense Hidden",
  "Divine Magic",
  // "Wind Walk",
  "Vitality of Air",
  "Poison Vapours",
  "Call Winds",
  "Body of Air",
  "Call Air Elemental",
  "Strength of Earth",
  "Stone Throw",
  "Wall of Stone",
  // "Merge with Stone",
  "Body of Stone",
  "Call Earth Elemental",
  // "Repel Flames",
  "Agility of Fire",
  "Wall of Fire",
  "Fireflash",
  "Body of Fire",
  "Call Fire Elemental",
  "Purity of Water",
  "Call Fog",
  // "Water Walk",
  "Squall of Ice",
  "Body of Water",
  "Call Water Elemental",
  "Shield of Protection",
  "Jolt",
  "Wall of Force",
  "Bolt of Lightning",
  "Disintegrate",
  "Charm",
  "Stun",
  "Drain Will (WAS Stupefy)",
  "Nightmare",
  "Dominate Will",
  "Resist Magic",
  "Disperse Magic",
  "Dweomer Shield",
  "Bonds of Magick",
  "Reflection Shield",
  "Hardened Hands",
  "Weaken",
  // "Stone to Flesh",
  "Shrink",
  "Flesh to Stone",
  "Polymorph Other",
  "Charm Beast",
  "Entangle",
  "Control Beast",
  "Succor Beast",
  "Regenerate",
  "Harm",
  // "Poison",
  "Conjure Spirit",
  "Summon Undead",
  // "Greater Skeleton?",
  "Create Undead",
  "Quench Life",
  "Minor Healing",
  "Halt Poison",
  "Major Healing",
  "Sanctuary",
  "Ressurrect",
  "Illuminate",
  "Flash",
  "Blur Sight",
  "Phantasmal Fiend",
  "Invisibility",
  "Plague of Insects",
  "Orcish Champion",
  "Guardian Ogre",
  // "Whisper to Shadows",
  "Hellgate",
  "Familiar",
  "Magelock",
  "Congeal Time",
  "Hasten",
  "Stasis",
  "Tempus Fugit"
];

//item olny starts at 5000
var itemOnly = [
  "Regeneration",
  "Drain Life",
  "Fire Shield",
  "Shield",
  "Invisibility, Continuing (Ring)",
  "Demonic Armor: Base Effects",
  "Demonic Armor: Dmg Shield",
  "Electrical Shield",
  "SnakeForm",
  "EarthQuake",
  "Harm Undead",
  "Area Fear Undead",
  "Holy Smiting",
  "Slaying Strength",
  "Hammer of the Earth",
  "Axe of the Winds",
  "Dagger of Pain",
  "Animate Corpse",
  "Spell Breaker",
  "Bashing",
  "Life Ward",
  "Chain Lightning",
  "Greater Healing",
  "Steal Life",
  "Mind Warp",
  "Unrevivifiable Undead",
  "Area Fear",
  "Area Fatigue",
  "Area Fear (Animals)",
  "Area Reanimate",
  "Wolf Form",
  "Returning",
  "Staff of the Necromancer",
  "Paralyze (Evil)",
  "Elven Perfume",
  "Heal Light (Will'O'Wisp)",
  "Reserved for Pad Lighting (Pad Lighting1)",
  "Reserved for Pad Lighting (Pad Lighting2)",
  "Reserved for Pad Lighting (Pad Lighting3)",
  "Reserved for Pad Lighting (Pad Lighting4)",
  "Reserved for Pad Lighting (Pad Lighting5)",
  "SuperHeal (SuperHeal)",
  "Araya Projectile",
  "Summon Seether",
  "Summon Were-Rat",
  "Summon Wargun",
  "Summon Baleful Hound",
  "Flesh to Stone (Duration)",
  "Slow Party",
  "Poison DOT (Evil variation on Regenerate)",
  "Fatigue DOT",
  "Call Winds (All)",
  "Unseen Force  (All)",
  "Stasis (Duration)",
  "Freeze",
  "Summon Undead",
  "Conjure Spirit II  -- Different art, used for Pelogian (Mike) in Tulla",
  "Heal Potion",
  "Haste Boots",
  "MI 59"
];

//tech item only starts at 10000
var techItem = [
  "mtTechSnare [Mechanical: Bear Trap]",
  "mtTechBrainBuilder [Item: Brain Builder]",
  "mtTechHypnoticSuggestion [Item: Elixir of Hypnotic Suggestion]",
  "mtTechParalysis [Basic Tech: Paralysis (Duration) Effect]",
  "mtTechMuscleMaker [Item: Muscle Maker]",
  "mtTechDexEnhancer [Electrical: Charged Ring]",
  "mtTechMagicDetect [Electrical: Magic Detector]",
  "mtTechJolt [Electrical: Shocking Staff]",
  "mtTechExplodeHallucinate [Item: Hallucinate (Grenade)]",
  "mtTechHealRegen [Electrical: Healing Jacket]",
  "mtTechHealLight [Anatomical: Heal Light]",
  "mtTechFatigueRestore [Anatomical: Fatigue Restore]",
  "mtTechCurePoison [Anatomical: Cure Poison]",
  "mtTechFatigueLimiter [Anatomical: Fatigue Limiter]",
  "mtTechHealAccelerator [Anatomical: Heal Accelerator]",
  "mtTechWonderDrug [Anatomical: Wonder Drug]",
  "mtTechCureAll [Anatomical: Cure All]",
  "mtTechBoostIntelligence [Elixirs: Boost Intelligence]",
  "mtTechBoostStrength [Elixirs: Boost Strength]",
  "mtTechBoostPerception [Elixirs: Boost Perception]",
  "mtTechBoostDexterity [Elixirs: Boost Dexterity]",
  "mtTechBoostMental [Elixirs: Boost Mental Stats]",
  "mtTechBoostPhysical [Elixirs: Boost Physical Stats]",
  "mtTechBoostAll [Elixirs: Boost All Stats]",
  "mtTechPoison [Chemistry: Poison]",
  "mtTechHallucinate [Chemistry: Hallucinite]",
  "mtTechAcid [Chemistry: Acid (???)]",
  "mtTechAnimalScent [Chemistry: Animal Scent]",
  "mtTechChargedRegen [Armor: Charged Regenerate]",
  "mtTechVenom [Food: Venom]",
  "mtTechCleaner [Food: Cleaner]",
  "mtTechStrongPoison [Food: Strong Poison]",
  "mtTechWine [Food: Wine]",
  "mtTechWine [Food: Aqua Vitae]",
  "mtTechElectricalShield [Armor: Electrical Shield]",
  "mtTechExplosion [Item: Explosion (Grenade)]",
  "mtTechDynamite [Item: Explosion (Dynamite)]",
  "mtTechExplodeFlash [Item: Explode (Flash)]",
  "mtTechExplodeSmoke [Item: Explode (Smoke)]",
  "mtTechExplodeStun [Item: Explode (Stun)]",
  "mtTechExplodeFire [Item: Explode (Fire)] -- Fire Obstruction/Barrier of Fire",
  "mtTechAlchohol [Food: Wine]",
  "mtTechMagneticInversion [Item: Magnetic Inversion]",
  "mtTechAnimalLure [Item: Animal Lure]",
  "mtTechTrapSpringer [Item: Trap Springer]",
  "mtTechExplodePoison [Item: Explode (Poison)]",
  "mtTechFlash [Item: Flash (Blindness)]",
  "mtTechMagneticInversionCharge [Item: Magnetic Inversion Charge]",
  "mtTechTrapSkillEnhancer [Item: Arm/Disarm Trap Skill Enhancer]",
  "mtTechInvigorator [Item: Invigorator]",
  "mtTechReanimator [Item: Raise Dead]",
  "mtTechHealInjection [Item: Clockwork Physician]",
  "mtTechMiracleCure [Item: Super Wonder Drug]",
  "mtTechMentalInhibitor [Item: Stupify]",
  "mtTechNecromizer [Item: Zombify]",
  "mtTechFortifier [Item: Fortifier]",
  "mtTechSleepAid [Item: Sleep Aid]",
  "mtTechPotionOfParalysis [Item: Potion of Paralysis]",
  "mtTechKnockOutGas [Item: Knock-Out Gas]",
  "mtTechExplodeElectrical [Item: Electrocution (Grenade)]",
  "mtTechMustardGas [Item: Mustard Gas (Grenade)]",
  "mtTechExplodeConcussion [Item: Concussion (Grenade)]",
  "mtTechExplodeParalysis [Item: Paralysis (Grenade)]",
  "mtTechGrenadeLauncher [Item: Grenade Launcher]",
  "mtTechTranquilizerGun [Item: Tranquilizer Gun]",
  "mtTechExplodeGL [Item: Grenade Launcher Part II]",
  "mtTechVivifier [Item: Vivifier]"
];

//item only part 2 starts at 13350
var itemOnlySecondPart = [
  "mtMI2KerghanDeathSpell [Kerghan-specific-caster Death Spell]",
  "mtMI2KerghanAtkSpell [Kerghan-specific-caster Attack Spell]",
  "mtMI2KerghanHealing [Kerghan-specific-caster Healing Spell]",
  "mtMI2PotionFatigueSlower [Item: Potion of Fatigue Slower]",
  "mtMI2PotionEssenceOfIntellect [Potion of Essence of Intellect]",
  "mtMI2PotionHaste [Item: Potion of Haste]",
  "mtMI2PotionLiquidOfSkinThickening [Item: Potion of ]",
  "mtMI2PotionKalispisVenom [Item: Potion of Kalispi's Venom]",
  "mtMI2PotionRestorative []",
  "mtMI2ConjureSpiritPermanent []",
  "mtMI2PhantomKnightDeath []",
  "Teleport Exit",
  "Tech: Molotov Cocktail",
  "Tech: Time Bomb",
  "MI2: Quench Life (Full)",
  "Wolf Form (Permanent)"
];

function fetchColleges() {
  map = new Map();
  map.set("Conveyance", "conveyance");
  map.set("Divination", "divination");
  map.set("Air", "air");
  map.set("Earth", "earth");
  map.set("Fire", "fire");
  map.set("Water", "water");
  map.set("Force", "force");
  map.set("Mental", "mental");
  map.set("Meta", "meta");
  map.set("Morph", "morph");
  map.set("Nature", "nature");
  map.set("Necromantic (Evil)", "necromanticEvil");
  map.set("Necromantic (Good)", "necromanticGood");
  map.set("Phantasm", "phantasm");
  map.set("Summon", "summon");
  map.set("Temporal", "temporal");
  return map;
}

function fetchSpells() {
  map = new Map();
  map.set("Disarm", "disarm");
  map.set("Unlocking Cantrip", "unlockingCantrip");
  map.set("Unseen Force", "unseenForce");
  map.set("Spatial Distortion", "spatialDistortion");
  map.set("Teleportation", "teleportation");
  map.set("Sense Alignment", "senseAlignment");
  map.set("See Contents", "seeContents");
  map.set("Sense Aura", "senseAura");
  map.set("Sense Hidden", "senseHidden");
  map.set("Divine Magic", "divineMagic");
  map.set("Vitality of Air", "vitalityOfAir");
  map.set("Poison Vapours", "poisonVapours");
  map.set("Call Winds", "callWinds");
  map.set("Body of Air", "bodyOfAir");
  map.set("Call Air Elemental", "callAirElemental");
  map.set("Strength of Earth", "strengthOfEarth");
  map.set("Stone Throw", "stoneThrow");
  map.set("Wall of Stone", "wallOfStone");
  map.set("Body of Stone", "bodyOfStone");
  map.set("Call Earth Elemental", "callEarthElemental");
  map.set("Agility of Fire", "agilityOfFire");
  map.set("Wall of Fire", "wallOfFire");
  map.set("Fireflash", "firelash");
  map.set("Body of Fire", "bodyOfFire");
  map.set("Call Fire Elemental", "callFireElemental");
  map.set("Purity of Water", "purityOfWater");
  map.set("Call Fog", "callFog");
  map.set("Squall of Ice", "squallOfIce");
  map.set("Body of Water", "bodyOfWater");
  map.set("Call Water Elemental", "callWaterElemental");
  map.set("Shield of Protection", "shieldOfProtection");
  map.set("Jolt", "jolt");
  map.set("Wall of Force", "wallOfForce");
  map.set("Bolt of Lightning", "boltOfLighting");
  map.set("Disintegrate", "disintegrate");
  map.set("Charm", "charm");
  map.set("Stun", "stun");
  map.set("Drain Will (WAS Stupefy)", "drainWill");
  map.set("Nightmare", "nightmare");
  map.set("Dominate Will", "dominateWill");
  map.set("Resist Magic", "resistMagic");
  map.set("Disperse Magic", "disperseMagic");
  map.set("Dweomer Shield", "dweomerShield");
  map.set("Bonds of Magick", "bondsOfMagick");
  map.set("Reflection Shield", "reflectionShield");
  map.set("Hardened Hands", "hardenedHands");
  map.set("Weaken", "weaken");
  map.set("Shrink", "shrink");
  map.set("Flesh to Stone", "fleshToStone");
  map.set("Polymorph Other", "polymorphOther");
  map.set("Charm Beast", "charmBeast");
  map.set("Entangle", "entangle");
  map.set("Control Beast", "controlBeast");
  map.set("Succor Beast", "succorBeast");
  map.set("Regenerate", "regenerate");
  map.set("Harm", "harm");
  map.set("Conjure Spirit", "conjureSpirit");
  map.set("Summon Undead", "summonUndead");
  map.set("Create Undead", "createUndead");
  map.set("Quench Life", "quenchLife");
  map.set("Minor Healing", "mirrorHealing");
  map.set("Halt Poison", "haltPoison");
  map.set("Major Healing", "majorHealing");
  map.set("Sanctuary", "sanctuary");
  map.set("Ressurrect", "ressurrect");
  map.set("Illuminate", "illuminate");
  map.set("Flash", "flash");
  map.set("Blur Sight", "blurSight");
  map.set("Phantasmal Fiend", "phantasmalFiend");
  map.set("Invisibility", "invisibility");
  map.set("Plague of Insects", "plagueOfInsects");
  map.set("Orcish Champion", "orcishChampion");
  map.set("Guardian Ogre", "guardianOgre");
  map.set("Hellgate", "hellgate");
  map.set("Familiar", "familiar");
  map.set("Magelock", "magelock");
  map.set("Congeal Time", "congealTime");
  map.set("Hasten", "hasten");
  map.set("Stasis", "stasis");
  map.set("Tempus Fugit", "tempusFugit");
  return map;
}

var collegeNames = [
  "Conveyance",
  "Divination",
  "Air",
  "Earth",
  "Fire",
  "Water",
  "Force",
  "Mental",
  "Meta",
  "Morph",
  "Nature",
  "Necromantic (Evil)",
  "Necromantic (Good)",
  "Phantasm",
  "Summon",
  "Temporal"
];

module.exports.generatePatternForSingleFile("SpellList", "C:/Users/Lorthiz/Desktop/rules/", "../Resources/out/");
// generatePatternForSingleFile("C:/Users/Lorthiz/Desktop/rules/SpellList.mes", "SpellList");




