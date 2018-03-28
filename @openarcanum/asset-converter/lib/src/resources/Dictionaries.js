module.exports = {
  generateDictionary: function () {
    var descTypeMap = new Map();
    descTypeMap.set("Asking for rumors", "askForRumors");
    descTypeMap.set("Appreciation (thanks)", "appreciation");
    descTypeMap.set("Insult", "insult");

    descTypeMap.set("Asking for money", "askForMoney");
    descTypeMap.set("Not enough money", "notEnoughMoney");
    descTypeMap.set("Offers to train a beginner", "offersToTrainABeginner");
    descTypeMap.set("Already trained", "alreadyTrained");
    descTypeMap.set("Not ready to train", "notReadyToTrain");
    descTypeMap.set("Did training", "didTraining");
    descTypeMap.set("No rumors", "noRumors");
    descTypeMap.set("Initial great greeting", "initialGreatGreeting");
    descTypeMap.set("Initial good greeting", "initialGoodGreeting");
    descTypeMap.set("Initial neutral greeting", "initialNeutralGreeting");
    descTypeMap.set("Second great greeting", "secondGreatGreeting");
    descTypeMap.set("Second good greeting", "secondGoodGreeting");
    descTypeMap.set("Second neutral greeting", "secondNeutralGreeting");
    descTypeMap.set("Offer healing", "offerHealing");
    descTypeMap.set("Finished", "finished");
    descTypeMap.set("Fear of associates", "fearOfAssociates");
    descTypeMap.set("Body spell", "bodySpell");
    descTypeMap.set("Polymorph", "polymorph");
    descTypeMap.set("Mirror image", "mirrorImage");
    descTypeMap.set("Invisibility", "invisibility");

    descTypeMap.set("Greeting a PC in underwear", "greetInUnderwear");
    descTypeMap.set("Greeting a PC in barbarian armor", "greetInBarbarianArmor");
    descTypeMap.set("Initial bad greeting", "initialBadGreeting");
    descTypeMap.set("Second bad greeting", "secondBadGreeting");
    descTypeMap.set("Initial worst greeting", "initialWorstGreeting");
    descTypeMap.set("Second worst greeting", "secondBadGreeting");
    descTypeMap.set("Shrink spell", "shrinkSpell");
    descTypeMap.set("Offer directions", "offerDirections");
    descTypeMap.set("Offer to mark map", "offerToMarkMap");
    descTypeMap.set("Nearby map marking", "nearbyMapMarking");
    descTypeMap.set("Non-nearby map marking", "nonNearbyMapMarking");
    descTypeMap.set("Sell", "sell");
    descTypeMap.set("Will not sell", "willNotSell");
    descTypeMap.set("Normally will not sell", "normallyWillNotSell");
    descTypeMap.set("Buy", "buy");
    descTypeMap.set("Will not buy", "willNotBuy");
    descTypeMap.set("Normally will not buy", "normallyWillNotBuy");
    descTypeMap.set("Buy for less", "buyForLess");

    descTypeMap.set("Yes messages go", "yes");
    descTypeMap.set("No messages go", "no");
    descTypeMap.set("Sorry messages go", "sorry");
    descTypeMap.set("Barter messages go", "barter");
    descTypeMap.set("Exit messages go", "exit");
    descTypeMap.set("Ask for training messages go", "askForTraining");
    descTypeMap.set("Ask for healing messages go", "askForHealing");
    descTypeMap.set("Forget it messages go", "forgeIt");
    descTypeMap.set("Use skill messages go", "useSkill");
    descTypeMap.set("Use spell messages go", "useSpell");
    descTypeMap.set("Asking to heal wounds messages go", "askingToHealWounds");
    descTypeMap.set("Asking to heal poison messages go", "askingToHealPoison");
    descTypeMap.set("Asking for directions messages go", "askingFroDirections");
    descTypeMap.set("Asking for map-marking messages go", "askingForMapMarking");
    descTypeMap.set("Bartering with follower messages go", "barteringWithFollower");
    descTypeMap.set("Story state messages go", "storyState");
    descTypeMap.set("Who are you? messages go", "whoAreYou");
    descTypeMap.set("Continue messages goes", "continue");
    descTypeMap.set("Asking for more questions go", "askQuestion");
    descTypeMap.set("asking for a newspaper messages go", "askForNewspaper");
    descTypeMap.set("asking for the headline of today's newspaper go", "askForHeadline");
    descTypeMap.set("asking for older newspapers go", "askForOlderNewspaper");
    descTypeMap.set("asking to buy todays newspaper go", "askForTodayNewspaper");
    descTypeMap.set("wants to start the WorldMap go", "startWorldMap");
    descTypeMap.set("Request to ask more questions go", "askMoreQuestions");

    descTypeMap.set("Nearby directions", "nearbyDirections");
    descTypeMap.set("Medium directions", "mediumDirections");
    descTypeMap.set("Far directions", "farDirections");
    descTypeMap.set("Nearby map marking messages", "nearbyMapMarking");
    descTypeMap.set("Non-nearby map marking messages", "notNearbyMapMarking");


    descTypeMap.set("The NPC is dead and has Speak With Dead cast upon it.", "speakWithDead");
    descTypeMap.set("The NPC will not follow the PC because the PC is too good", "pcIsTooGood");
    descTypeMap.set("The NPC will not follow the PC because the PC is too evil", "pcIsTooEvil");
    descTypeMap.set("The NPC will not follow the PC because the NPC dislikes the PC", "pcIsDisliked");
    descTypeMap.set("Good farewells (the NPC is neutral or happy with the PC)", "goodFarewell");
    descTypeMap.set("Bad farewells (the NPC is suspicious or worse of the NPC)", "badFarewell");
    descTypeMap.set("NPC is acknowledging an order from the PC", "orderAcknowledged");
    descTypeMap.set("NPC cannot acknowledge an order from the PC", "orderNotAcknowledged");
    descTypeMap.set("NPC was accidentally hit by the PC", "accidentallHit");
    descTypeMap.set("NPC witnesses PC critical hit", "criticalHitComment");
    descTypeMap.set("NPC witnesses PC critical miss", "criticalMissComment");
    descTypeMap.set("The NPC will not follow the PC because the NPC is already grouped with another PC who is at least as charismatic", "pcAlreadyGrouped");
    descTypeMap.set("The NPC will not follow the PC because the PC is at his charisma limit (which is greater zero)", "pcIsAtCharismaLimit");
    descTypeMap.set("The NPC will not follow the PC because the PCs charisma does not allow for followers", "charismaDoesNotAllowForFollowers");
    descTypeMap.set("The NPC is too high level for the PC to be a follower", "npcLevelTooHighToFollow");
    descTypeMap.set("The NPC is fleeing from a combatant", "npcIsFleeing");
    descTypeMap.set("gamble win messages", "gambleWin");
    descTypeMap.set("gamble lose messages", "gambleLose");
    descTypeMap.set("gambling pc things", "gamblePcThings");
    descTypeMap.set("gambling with low rank or training", "gamblingTooLow");
    descTypeMap.set("gambling without enough money", "gamblingWithoutSimoleons");
    descTypeMap.set("gambling for what NPC is wearing", "gamblingForNpcPants");
    descTypeMap.set("gambling for something the NPC really wants to keep", "gamblingForPersonalBelongings");
    descTypeMap.set("the NPC will not normally gamble, but is making an exception", "normallyWouldNotGamble");
    descTypeMap.set("the NPC makes a gamble offer", "npcGambleOffer");
    descTypeMap.set("the NPC is warning the listener to stop what they are doing", "stopIt");
    descTypeMap.set("the NPC is shouting about a newspaper he is selling", "sellingNewspapers");
    descTypeMap.set("the NPC is asking the PC about buying newspapers", "sellingNewspapersToPC");
    descTypeMap.set("the NPC wants to sell a particular newspaper", "sellingParticularNewspaper");
    descTypeMap.set("the NPC has no older newspapers for sale", "noOlderNewspapers");
    descTypeMap.set("the NPC is offer older newspapers for sale", "offeringOlderNewspaper");
    descTypeMap.set("the NPC is refusing to buy stolen goods", "khajjitIsInnocentOfThisCrime");
    descTypeMap.set("the NPC is offering to use his skill and do the task for the PC leader", "offeringToUseSkill");
    descTypeMap.set("the NPC is upset that the PC is attacking party members", "pcIsAttackingPartyMembers");
    descTypeMap.set("the NPC is upset the PC is attacking good creatures", "psIsAttackingGoodCreatures");
    descTypeMap.set("the NPC is upset the PC is attacking townspeople from NPCs origin", "pcIsAttackingCommonFolk");
    descTypeMap.set("the NPC is upset the PC is attacking faction buddies", "pcIsAttackingFractionBuddies");
    descTypeMap.set("the NPC is warning the PC he is becoming too good", "pcIsBecomingTooGood");
    descTypeMap.set("the NPC is warning the PC he is becoming too evil", "pcIsBecomingTooEvil");
    descTypeMap.set("the NPC is warning the PC of low reaction to him", "npcIsNotAmused");
    descTypeMap.set("the NPC follower is nearing death", "npcIsNearDeath");
    descTypeMap.set("the NPC is not skilled in gambling", "npcIsNotSkilledInGambling");
    descTypeMap.set("the NPC does not need to identify an item (as it is already identified)", "itemAlreadyIdentified");
    descTypeMap.set("the NPC wants money for identifying an item", "payForIdentification");
    descTypeMap.set("the NPC cannot repair broken items", "npcCannotRepair");
    descTypeMap.set("the NPC does not need to repair the item (it is not damaged)", "itemDoesNotNeedReparation");
    descTypeMap.set("the NPC wants money for repairing the item", "payForRepair");
    descTypeMap.set("PC doesnt have enough skill points to be trained as expert", "notEnoughSkillPointsForExpert");
    descTypeMap.set("PC doesnt have beginner training", "pcIsNotEvenABeginner");

    var classes = ['noble', 'priest', 'wizard', 'technologist', 'shopkeeper', 'guard', 'city_dweller', 'villager', 'beggar', 'thief', 'bandit'];

    var races = ["human", "dwarf", "elf", "half elf", "gnome", "halfling", "half orc", "half ogre", "dark elf", "ogre", "orc"];

    var directions = ["north", "northEast", "east", "southEast", "south", "southWest", "west", "northWest"];

    return {descTypeMap: descTypeMap, classes: classes, races: races, directions: directions};
  }
};
