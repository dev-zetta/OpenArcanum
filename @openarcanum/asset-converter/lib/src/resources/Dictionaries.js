module.exports = {
  generalDialogue: function() {
    var descTypeMap = new Map();
    descTypeMap.set('Asking for rumors', 'askForRumors');
    descTypeMap.set('Appreciation (thanks)', 'appreciation');
    descTypeMap.set('Insult', 'insult');

    descTypeMap.set('Asking for money', 'askForMoney');
    descTypeMap.set('Not enough money', 'notEnoughMoney');
    descTypeMap.set('Offers to train a beginner', 'offersToTrainABeginner');
    descTypeMap.set('Already trained', 'alreadyTrained');
    descTypeMap.set('Not ready to train', 'notReadyToTrain');
    descTypeMap.set('Did training', 'didTraining');
    descTypeMap.set('No rumors', 'noRumors');
    descTypeMap.set('Initial great greeting', 'initialGreatGreeting');
    descTypeMap.set('Initial good greeting', 'initialGoodGreeting');
    descTypeMap.set('Initial neutral greeting', 'initialNeutralGreeting');
    descTypeMap.set('Second great greeting', 'secondGreatGreeting');
    descTypeMap.set('Second good greeting', 'secondGoodGreeting');
    descTypeMap.set('Second neutral greeting', 'secondNeutralGreeting');
    descTypeMap.set('Offer healing', 'offerHealing');
    descTypeMap.set('Finished', 'finished');
    descTypeMap.set('Fear of associates', 'fearOfAssociates');
    descTypeMap.set('Body spell', 'bodySpell');
    descTypeMap.set('Polymorph', 'polymorph');
    descTypeMap.set('Mirror image', 'mirrorImage');
    descTypeMap.set('Invisibility', 'invisibility');

    descTypeMap.set('Greeting a PC in underwear', 'greetInUnderwear');
    descTypeMap.set('Greeting a PC in barbarian armor', 'greetInBarbarianArmor');
    descTypeMap.set('Initial bad greeting', 'initialBadGreeting');
    descTypeMap.set('Second bad greeting', 'secondBadGreeting');
    descTypeMap.set('Initial worst greeting', 'initialWorstGreeting');
    descTypeMap.set('Second worst greeting', 'secondBadGreeting');
    descTypeMap.set('Shrink spell', 'shrinkSpell');
    descTypeMap.set('Offer directions', 'offerDirections');
    descTypeMap.set('Offer to mark map', 'offerToMarkMap');
    descTypeMap.set('Nearby map marking', 'nearbyMapMarking');
    descTypeMap.set('Non-nearby map marking', 'nonNearbyMapMarking');
    descTypeMap.set('Sell', 'sell');
    descTypeMap.set('Will not sell', 'willNotSell');
    descTypeMap.set('Normally will not sell', 'normallyWillNotSell');
    descTypeMap.set('Buy', 'buy');
    descTypeMap.set('Will not buy', 'willNotBuy');
    descTypeMap.set('Normally will not buy', 'normallyWillNotBuy');
    descTypeMap.set('Buy for less', 'buyForLess');

    descTypeMap.set('Yes messages go', 'yes');
    descTypeMap.set('No messages go', 'no');
    descTypeMap.set('Sorry messages go', 'sorry');
    descTypeMap.set('Barter messages go', 'barter');
    descTypeMap.set('Exit messages go', 'exit');
    descTypeMap.set('Ask for training messages go', 'askForTraining');
    descTypeMap.set('Ask for healing messages go', 'askForHealing');
    descTypeMap.set('Forget it messages go', 'forgeIt');
    descTypeMap.set('Use skill messages go', 'useSkill');
    descTypeMap.set('Use spell messages go', 'useSpell');
    descTypeMap.set('Asking to heal wounds messages go', 'askingToHealWounds');
    descTypeMap.set('Asking to heal poison messages go', 'askingToHealPoison');
    descTypeMap.set('Asking for directions messages go', 'askingFroDirections');
    descTypeMap.set('Asking for map-marking messages go', 'askingForMapMarking');
    descTypeMap.set('Bartering with follower messages go', 'barteringWithFollower');
    descTypeMap.set('Story state messages go', 'storyState');
    descTypeMap.set('Who are you? messages go', 'whoAreYou');
    descTypeMap.set('Continue messages goes', 'continue');
    descTypeMap.set('Asking for more questions go', 'askQuestion');
    descTypeMap.set('asking for a newspaper messages go', 'askForNewspaper');
    descTypeMap.set("asking for the headline of today's newspaper go", 'askForHeadline');
    descTypeMap.set('asking for older newspapers go', 'askForOlderNewspaper');
    descTypeMap.set('asking to buy todays newspaper go', 'askForTodayNewspaper');
    descTypeMap.set('wants to start the WorldMap go', 'startWorldMap');
    descTypeMap.set('Request to ask more questions go', 'askMoreQuestions');

    descTypeMap.set('Nearby directions', 'nearbyDirections');
    descTypeMap.set('Medium directions', 'mediumDirections');
    descTypeMap.set('Far directions', 'farDirections');
    descTypeMap.set('Nearby map marking messages', 'nearbyMapMarking');
    descTypeMap.set('Non-nearby map marking messages', 'notNearbyMapMarking');

    descTypeMap.set(
      'The NPC is dead and has Speak With Dead cast upon it.',
      'speakWithDead'
    );
    descTypeMap.set(
      'The NPC will not follow the PC because the PC is too good',
      'pcIsTooGood'
    );
    descTypeMap.set(
      'The NPC will not follow the PC because the PC is too evil',
      'pcIsTooEvil'
    );
    descTypeMap.set(
      'The NPC will not follow the PC because the NPC dislikes the PC',
      'pcIsDisliked'
    );
    descTypeMap.set(
      'Good farewells (the NPC is neutral or happy with the PC)',
      'goodFarewell'
    );
    descTypeMap.set(
      'Bad farewells (the NPC is suspicious or worse of the NPC)',
      'badFarewell'
    );
    descTypeMap.set('NPC is acknowledging an order from the PC', 'orderAcknowledged');
    descTypeMap.set(
      'NPC cannot acknowledge an order from the PC',
      'orderNotAcknowledged'
    );
    descTypeMap.set('NPC was accidentally hit by the PC', 'accidentallHit');
    descTypeMap.set('NPC witnesses PC critical hit', 'criticalHitComment');
    descTypeMap.set('NPC witnesses PC critical miss', 'criticalMissComment');
    descTypeMap.set(
      'The NPC will not follow the PC because the NPC is already grouped with another PC who is at least as charismatic',
      'pcAlreadyGrouped'
    );
    descTypeMap.set(
      'The NPC will not follow the PC because the PC is at his charisma limit (which is greater zero)',
      'pcIsAtCharismaLimit'
    );
    descTypeMap.set(
      'The NPC will not follow the PC because the PCs charisma does not allow for followers',
      'charismaDoesNotAllowForFollowers'
    );
    descTypeMap.set(
      'The NPC is too high level for the PC to be a follower',
      'npcLevelTooHighToFollow'
    );
    descTypeMap.set('The NPC is fleeing from a combatant', 'npcIsFleeing');
    descTypeMap.set('gamble win messages', 'gambleWin');
    descTypeMap.set('gamble lose messages', 'gambleLose');
    descTypeMap.set('gambling pc things', 'gamblePcThings');
    descTypeMap.set('gambling with low rank or training', 'gamblingTooLow');
    descTypeMap.set('gambling without enough money', 'gamblingWithoutSimoleons');
    descTypeMap.set('gambling for what NPC is wearing', 'gamblingForNpcPants');
    descTypeMap.set(
      'gambling for something the NPC really wants to keep',
      'gamblingForPersonalBelongings'
    );
    descTypeMap.set(
      'the NPC will not normally gamble, but is making an exception',
      'normallyWouldNotGamble'
    );
    descTypeMap.set('the NPC makes a gamble offer', 'npcGambleOffer');
    descTypeMap.set(
      'the NPC is warning the listener to stop what they are doing',
      'stopIt'
    );
    descTypeMap.set(
      'the NPC is shouting about a newspaper he is selling',
      'sellingNewspapers'
    );
    descTypeMap.set(
      'the NPC is asking the PC about buying newspapers',
      'sellingNewspapersToPC'
    );
    descTypeMap.set(
      'the NPC wants to sell a particular newspaper',
      'sellingParticularNewspaper'
    );
    descTypeMap.set('the NPC has no older newspapers for sale', 'noOlderNewspapers');
    descTypeMap.set(
      'the NPC is offer older newspapers for sale',
      'offeringOlderNewspaper'
    );
    descTypeMap.set(
      'the NPC is refusing to buy stolen goods',
      'khajjitIsInnocentOfThisCrime'
    );
    descTypeMap.set(
      'the NPC is offering to use his skill and do the task for the PC leader',
      'offeringToUseSkill'
    );
    descTypeMap.set(
      'the NPC is upset that the PC is attacking party members',
      'pcIsAttackingPartyMembers'
    );
    descTypeMap.set(
      'the NPC is upset the PC is attacking good creatures',
      'psIsAttackingGoodCreatures'
    );
    descTypeMap.set(
      'the NPC is upset the PC is attacking townspeople from NPCs origin',
      'pcIsAttackingCommonFolk'
    );
    descTypeMap.set(
      'the NPC is upset the PC is attacking faction buddies',
      'pcIsAttackingFractionBuddies'
    );
    descTypeMap.set(
      'the NPC is warning the PC he is becoming too good',
      'pcIsBecomingTooGood'
    );
    descTypeMap.set(
      'the NPC is warning the PC he is becoming too evil',
      'pcIsBecomingTooEvil'
    );
    descTypeMap.set('the NPC is warning the PC of low reaction to him', 'npcIsNotAmused');
    descTypeMap.set('the NPC follower is nearing death', 'npcIsNearDeath');
    descTypeMap.set('the NPC is not skilled in gambling', 'npcIsNotSkilledInGambling');
    descTypeMap.set(
      'the NPC does not need to identify an item (as it is already identified)',
      'itemAlreadyIdentified'
    );
    descTypeMap.set(
      'the NPC wants money for identifying an item',
      'payForIdentification'
    );
    descTypeMap.set('the NPC cannot repair broken items', 'npcCannotRepair');
    descTypeMap.set(
      'the NPC does not need to repair the item (it is not damaged)',
      'itemDoesNotNeedReparation'
    );
    descTypeMap.set('the NPC wants money for repairing the item', 'payForRepair');
    descTypeMap.set(
      'PC doesnt have enough skill points to be trained as expert',
      'notEnoughSkillPointsForExpert'
    );
    descTypeMap.set('PC doesnt have beginner training', 'pcIsNotEvenABeginner');

    var classes = [
      'noble',
      'priest',
      'wizard',
      'technologist',
      'shopkeeper',
      'guard',
      'city_dweller',
      'villager',
      'beggar',
      'thief',
      'bandit'
    ];

    var races = [
      'human',
      'dwarf',
      'elf',
      'half elf',
      'gnome',
      'halfling',
      'half orc',
      'half ogre',
      'dark elf',
      'ogre',
      'orc'
    ];

    var directions = [
      'north',
      'northEast',
      'east',
      'southEast',
      'south',
      'southWest',
      'west',
      'northWest'
    ];

    return {
      descTypeMap: descTypeMap,
      classes: classes,
      races: races,
      directions: directions
    };
  },

  spellList: function() {
    var spells = new Map();
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

    var colleges = new Map();
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

    // Item olny starts at 5000
    var itemOnly = [
      'Regeneration',
      'Drain Life',
      'Fire Shield',
      'Shield',
      'Invisibility, Continuing (Ring)',
      'Demonic Armor: Base Effects',
      'Demonic Armor: Dmg Shield',
      'Electrical Shield',
      'SnakeForm',
      'EarthQuake',
      'Harm Undead',
      'Area Fear Undead',
      'Holy Smiting',
      'Slaying Strength',
      'Hammer of the Earth',
      'Axe of the Winds',
      'Dagger of Pain',
      'Animate Corpse',
      'Spell Breaker',
      'Bashing',
      'Life Ward',
      'Chain Lightning',
      'Greater Healing',
      'Steal Life',
      'Mind Warp',
      'Unrevivifiable Undead',
      'Area Fear',
      'Area Fatigue',
      'Area Fear (Animals)',
      'Area Reanimate',
      'Wolf Form',
      'Returning',
      'Staff of the Necromancer',
      'Paralyze (Evil)',
      'Elven Perfume',
      "Heal Light (Will'O'Wisp)",
      'Reserved for Pad Lighting (Pad Lighting1)',
      'Reserved for Pad Lighting (Pad Lighting2)',
      'Reserved for Pad Lighting (Pad Lighting3)',
      'Reserved for Pad Lighting (Pad Lighting4)',
      'Reserved for Pad Lighting (Pad Lighting5)',
      'SuperHeal (SuperHeal)',
      'Araya Projectile',
      'Summon Seether',
      'Summon Were-Rat',
      'Summon Wargun',
      'Summon Baleful Hound',
      'Flesh to Stone (Duration)',
      'Slow Party',
      'Poison DOT (Evil variation on Regenerate)',
      'Fatigue DOT',
      'Call Winds (All)',
      'Unseen Force  (All)',
      'Stasis (Duration)',
      'Freeze',
      'Summon Undead',
      'Conjure Spirit II  -- Different art, used for Pelogian (Mike) in Tulla',
      'Heal Potion',
      'Haste Boots',
      'MI 59'
    ];

    // Tech item only starts at 10000
    var techItem = [
      'mtTechSnare [Mechanical: Bear Trap]',
      'mtTechBrainBuilder [Item: Brain Builder]',
      'mtTechHypnoticSuggestion [Item: Elixir of Hypnotic Suggestion]',
      'mtTechParalysis [Basic Tech: Paralysis (Duration) Effect]',
      'mtTechMuscleMaker [Item: Muscle Maker]',
      'mtTechDexEnhancer [Electrical: Charged Ring]',
      'mtTechMagicDetect [Electrical: Magic Detector]',
      'mtTechJolt [Electrical: Shocking Staff]',
      'mtTechExplodeHallucinate [Item: Hallucinate (Grenade)]',
      'mtTechHealRegen [Electrical: Healing Jacket]',
      'mtTechHealLight [Anatomical: Heal Light]',
      'mtTechFatigueRestore [Anatomical: Fatigue Restore]',
      'mtTechCurePoison [Anatomical: Cure Poison]',
      'mtTechFatigueLimiter [Anatomical: Fatigue Limiter]',
      'mtTechHealAccelerator [Anatomical: Heal Accelerator]',
      'mtTechWonderDrug [Anatomical: Wonder Drug]',
      'mtTechCureAll [Anatomical: Cure All]',
      'mtTechBoostIntelligence [Elixirs: Boost Intelligence]',
      'mtTechBoostStrength [Elixirs: Boost Strength]',
      'mtTechBoostPerception [Elixirs: Boost Perception]',
      'mtTechBoostDexterity [Elixirs: Boost Dexterity]',
      'mtTechBoostMental [Elixirs: Boost Mental Stats]',
      'mtTechBoostPhysical [Elixirs: Boost Physical Stats]',
      'mtTechBoostAll [Elixirs: Boost All Stats]',
      'mtTechPoison [Chemistry: Poison]',
      'mtTechHallucinate [Chemistry: Hallucinite]',
      'mtTechAcid [Chemistry: Acid (???)]',
      'mtTechAnimalScent [Chemistry: Animal Scent]',
      'mtTechChargedRegen [Armor: Charged Regenerate]',
      'mtTechVenom [Food: Venom]',
      'mtTechCleaner [Food: Cleaner]',
      'mtTechStrongPoison [Food: Strong Poison]',
      'mtTechWine [Food: Wine]',
      'mtTechWine [Food: Aqua Vitae]',
      'mtTechElectricalShield [Armor: Electrical Shield]',
      'mtTechExplosion [Item: Explosion (Grenade)]',
      'mtTechDynamite [Item: Explosion (Dynamite)]',
      'mtTechExplodeFlash [Item: Explode (Flash)]',
      'mtTechExplodeSmoke [Item: Explode (Smoke)]',
      'mtTechExplodeStun [Item: Explode (Stun)]',
      'mtTechExplodeFire [Item: Explode (Fire)] -- Fire Obstruction/Barrier of Fire',
      'mtTechAlchohol [Food: Wine]',
      'mtTechMagneticInversion [Item: Magnetic Inversion]',
      'mtTechAnimalLure [Item: Animal Lure]',
      'mtTechTrapSpringer [Item: Trap Springer]',
      'mtTechExplodePoison [Item: Explode (Poison)]',
      'mtTechFlash [Item: Flash (Blindness)]',
      'mtTechMagneticInversionCharge [Item: Magnetic Inversion Charge]',
      'mtTechTrapSkillEnhancer [Item: Arm/Disarm Trap Skill Enhancer]',
      'mtTechInvigorator [Item: Invigorator]',
      'mtTechReanimator [Item: Raise Dead]',
      'mtTechHealInjection [Item: Clockwork Physician]',
      'mtTechMiracleCure [Item: Super Wonder Drug]',
      'mtTechMentalInhibitor [Item: Stupify]',
      'mtTechNecromizer [Item: Zombify]',
      'mtTechFortifier [Item: Fortifier]',
      'mtTechSleepAid [Item: Sleep Aid]',
      'mtTechPotionOfParalysis [Item: Potion of Paralysis]',
      'mtTechKnockOutGas [Item: Knock-Out Gas]',
      'mtTechExplodeElectrical [Item: Electrocution (Grenade)]',
      'mtTechMustardGas [Item: Mustard Gas (Grenade)]',
      'mtTechExplodeConcussion [Item: Concussion (Grenade)]',
      'mtTechExplodeParalysis [Item: Paralysis (Grenade)]',
      'mtTechGrenadeLauncher [Item: Grenade Launcher]',
      'mtTechTranquilizerGun [Item: Tranquilizer Gun]',
      'mtTechExplodeGL [Item: Grenade Launcher Part II]',
      'mtTechVivifier [Item: Vivifier]'
    ];

    // Item only part 2 starts at 13350
    var itemOnlySecondPart = [
      'mtMI2KerghanDeathSpell [Kerghan-specific-caster Death Spell]',
      'mtMI2KerghanAtkSpell [Kerghan-specific-caster Attack Spell]',
      'mtMI2KerghanHealing [Kerghan-specific-caster Healing Spell]',
      'mtMI2PotionFatigueSlower [Item: Potion of Fatigue Slower]',
      'mtMI2PotionEssenceOfIntellect [Potion of Essence of Intellect]',
      'mtMI2PotionHaste [Item: Potion of Haste]',
      'mtMI2PotionLiquidOfSkinThickening [Item: Potion of ]',
      "mtMI2PotionKalispisVenom [Item: Potion of Kalispi's Venom]",
      'mtMI2PotionRestorative []',
      'mtMI2ConjureSpiritPermanent []',
      'mtMI2PhantomKnightDeath []',
      'Teleport Exit',
      'Tech: Molotov Cocktail',
      'Tech: Time Bomb',
      'MI2: Quench Life (Full)',
      'Wolf Form (Permanent)'
    ];

    return {
      spells: spells,
      colleges: colleges,
      itemOnly: itemOnly,
      techItem: techItem,
      itemOnlySecondPart: itemOnlySecondPart
    };
  }
};
