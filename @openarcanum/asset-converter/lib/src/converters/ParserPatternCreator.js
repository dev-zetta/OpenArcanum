//*************
// GENERATORS
//*************

function writeParserPatternForFiles(files, inputFolder, outputFolder, parserFilename, writeAlsoToSingleFiles) {
    var generated = {};
    var dictionary = generateDictionary();
    for (var fileName in files) {
        var file = allFiles[fileName];
        generated[file.name] = generatePatternForSingleFile(inputFolder + file.name + ".mes", file, dictionary);
        if (writeAlsoToSingleFiles) {
            writeToFile(generated, outputFolder + file.name + ".json");
        }
    }
    writeToFile(generated, outputFolder + parserFilename + ".json");
}

function generatePatternForSingleFile(filePath, file, dictionary) {
    var data = readFile(filePath);
    if (data === null) {
        return null;
    }
    switch (file.type) {
        case "START_AT":
            return parseStartAtParser(parseStartAtMessageTypes(data, dictionary, file.name));
        case "BETWEEN":
            return prepareBetweenParser(parseBetweenMessageTypes(data, dictionary, file.name));
        case "CLASS":
            return prepareClassParser(parseClassMessageTypes(data, dictionary, file.name), dictionary);
        case "RACE":
            return prepareRacesParser(parseRacesMessageTypes(data, dictionary, file.name), dictionary);
        case "SPECIAL":
            return prepareSpecialTreatmentParser(
                parseSpecialTreatmentMessageTypes(data, dictionary, file.name),
                parseSpecialTreatmentDirectionMessageTypes(data, dictionary, file.name),
                fetchUnparsableMessageTypes(),
                dictionary
            );
        case "STORY":
            return prepareStoryParser(parseStoryMessageTypes(data, file.name), dictionary);
        default:
            console.log("Unknown file type: \"" + file.type + "\" for file: " + file.name);
            break;
    }
}

var allFiles = [
    {name: "gd_cls_dumb_f2f", type: "START_AT"},
    {name: "gd_cls_dumb_f2m", type: "START_AT"},
    {name: "gd_cls_dumb_m2f", type: "START_AT"},
    {name: "gd_cls_dumb_m2m", type: "START_AT"},
    {name: "gd_cls_dumb_pc2f", type: "CLASS"},
    {name: "gd_cls_dumb_pc2m", type: "CLASS"},
    {name: "gd_cls_f2f", type: "CLASS"},
    {name: "gd_cls_f2m", type: "CLASS"},
    {name: "gd_cls_m2f", type: "CLASS"},
    {name: "gd_cls_m2m", type: "CLASS"},
    {name: "gd_cls_pc2f", type: "CLASS"},
    {name: "gd_cls_pc2m", type: "CLASS"},
    {name: "gd_dumb_pc2f", type: "BETWEEN"},
    {name: "gd_dumb_pc2m", type: "BETWEEN"},
    {name: "gd_npc_f2f", type: "SPECIAL"},
    {name: "gd_npc_f2m", type: "SPECIAL"},
    {name: "gd_npc_m2f", type: "SPECIAL"},
    {name: "gd_npc_m2m", type: "SPECIAL"},
    {name: "gd_pc2f", type: "BETWEEN"},
    {name: "gd_pc2m", type: "BETWEEN"},
    {name: "gd_rce_dumb_f2f", type: "START_AT"},
    {name: "gd_rce_dumb_f2m", type: "START_AT"},
    {name: "gd_rce_dumb_m2f", type: "START_AT"},
    {name: "gd_rce_dumb_m2m", type: "START_AT"},
    {name: "gd_rce_f2f", type: "RACE"},
    {name: "gd_rce_f2m", type: "RACE"},
    {name: "gd_rce_m2f", type: "RACE"},
    {name: "gd_rce_m2m", type: "RACE"},
    {name: "gd_sto_f2f", type: "STORY"},
    {name: "gd_sto_f2m", type: "STORY"},
    {name: "gd_sto_m2f", type: "STORY"},
    {name: "gd_sto_m2m", type: "STORY"}
];

// **********************
// CLASS MESSAGE PARSER
// **********************

function parseClassMessageTypes(data, dictionary, filepath) {
    var messageTypes = [];
    var messageTypesArray = data.match(/\/\/ (.*) messages start at (\d+)./gm);
    for (var i = 0; i < messageTypesArray.length; ++i) {
        var messageGroup = messageTypesArray[i].match(/\/\/ (.*) messages start at (\d+)./);
        messageTypes.push({
            name: dictionary.descTypeMap.get(messageGroup[1]),
            start: messageGroup[2],
            jump: 50,
            description: messageGroup[1]
        });
        checkIfDictionaryEntryExists(messageGroup[1], filepath, dictionary.descTypeMap);
    }
    return messageTypes;
}

function prepareClassParser(messageTypes, dictionary) {
    var mesg = [];
    var classes = dictionary.classes;
    for (var i = 0; i < messageTypes.length; ++i) {
        var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
        for (var j = 0; j < classes.length; ++j) {
            _mesg.withClass(classes[j], new SingleMessageRecord(messageTypes[i].jump * j + parseInt(messageTypes[i].start), messageTypes[i].jump * j + parseInt(messageTypes[i].start) + parseInt(messageTypes[i].jump) - 1));
        }
        mesg.push(_mesg);
    }
    return mesg;
}

// ***************************
// START AT DIALOGUE OPTIONS
// ***************************

function parseStartAtMessageTypes(data, dictionary, filePath) {
    var messageTypes = [];
    var messageTypesArray = data.match(/\/\/ (.*) messages start at (\d+)./gm);
    for (var i = 0; i < messageTypesArray.length; ++i) {
        var messageGroup = messageTypesArray[i].match(/\/\/ (.*) messages start at (\d+)./);
        messageTypes.push({
            name: dictionary.descTypeMap.get(messageGroup[1]),
            start: messageGroup[2],
            jump: 1000,
            description: messageGroup[1]
        });
        checkIfDictionaryEntryExists(messageGroup[1], filePath, dictionary.descTypeMap);
    }
    return messageTypes;
}

function parseStartAtParser(messageTypes) {
    var mesg = [];
    for (var i = 0; i < messageTypes.length; ++i) {
        var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
        _mesg.withDefault(new SingleMessageRecord(parseInt(messageTypes[i].start), parseInt(messageTypes[i].start) + parseInt(messageTypes[i].jump) - 1));
        mesg.push(_mesg);
    }
    return mesg;
}

// **************************
// BETWEEN DIALOGUE OPTIONS
// **************************

function parseBetweenMessageTypes(data, dictionary, filePath) {
    var messageTypes = [];
    var messageTypesArray = data.match(/\/\/ (.*) between (\d+) and (\d+)/gm);
    for (var i = 0; i < messageTypesArray.length; ++i) {
        var messageGroup = messageTypesArray[i].match(/\/\/ (.*) between (\d+) and (\d+)/);
        messageTypes.push({
            name: dictionary.descTypeMap.get(messageGroup[1]),
            start: messageGroup[2],
            end: messageGroup[3],
            description: messageGroup[1]
        });
        checkIfDictionaryEntryExists(messageGroup[1], filePath, dictionary.descTypeMap);
    }
    return messageTypes;
}

function prepareBetweenParser(messageTypes) {
    var mesg = [];
    for (var i = 0; i < messageTypes.length; ++i) {
        var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
        _mesg.withDefault(new SingleMessageRecord(parseInt(messageTypes[i].start), parseInt(messageTypes[i].end)));
        mesg.push(_mesg);
    }
    return mesg;
}

// ************************
// RACES DIALOGUE OPTIONS
// ************************

function parseRacesMessageTypes(data, dictionary, filepath) {
    var messageTypes = [];
    var messageTypesArray = data.match(/\/\/ (.*) messages start at (\d+). Each PC race gets (\d+)/gm);
    for (var i = 0; i < messageTypesArray.length; ++i) {
        var messageGroup = messageTypesArray[i].match(/\/\/ (.*) messages start at (\d+). Each PC race gets (\d+)/);
        messageTypes.push({
            name: dictionary.descTypeMap.get(messageGroup[1]),
            start: messageGroup[2],
            jump: messageGroup[3],
            description: messageGroup[1]
        });
        checkIfDictionaryEntryExists(messageGroup[1], filepath, dictionary.descTypeMap);
    }
    return messageTypes;
}

function prepareRacesParser(messageTypes, dictionary) {
    var mesg = [];
    var races = dictionary.races;
    for (var i = 0; i < messageTypes.length; ++i) {
        var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
        _mesg.withDefault(new SingleMessageRecord(messageTypes[i].start, parseInt(messageTypes[i].start) + parseInt(messageTypes[i].jump) - 1));
        for (var j = 0; j < races.length; ++j) {
            _mesg.withRace(races[j], new SingleMessageRecord(messageTypes[i].jump * j + parseInt(messageTypes[i].start) + 50, messageTypes[i].jump * j + parseInt(messageTypes[i].start) + parseInt(messageTypes[i].jump) + 50 - 1));
        }
        mesg.push(_mesg);
    }
    return mesg;
}

// ************************
// STORY DIALOGUE OPTIONS
// ************************

function parseStoryMessageTypes(data) {
    var messageTypes = [];
    var messageTypesArray = data.match(/\/\/ Story state is (\d+)/gm);
    for (var i = 0; i < messageTypesArray.length; ++i) {
        var messageGroup = messageTypesArray[i].match(/\/\/ Story state is (\d+)/);
        messageTypes.push({
            name: "storyState_" + messageGroup[1],
            jump: 100,
            description: "Story state " + messageGroup[1]
        });
    }
    return messageTypes;
}

function prepareStoryParser(messageTypes, dictionary) {
    var mesg = [];
    var races = dictionary.races;
    for (var i = 0; i < messageTypes.length; ++i) {
        var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
        for (var j = 0; j < races.length; ++j) {
            _mesg.withRace(races[j], new SingleMessageRecord(i * messageTypes[i].jump + j, i * messageTypes[i].jump + j));
        }
        mesg.push(_mesg);
    }
    return mesg;
}

// **************************
// SPECIAL DIALOGUE OPTIONS
// **************************

function parseSpecialTreatmentMessageTypes(data, dictionary, filePath) {
    var messageTypes = [];
    var messageTypesArray = data.match(/\/\/ (.*) messages start at (\d+) and end at (\d+)/gm);
    for (var i = 0; i < messageTypesArray.length; ++i) {
        var messageGroup = messageTypesArray[i].match(/\/\/ (.*) messages start at (\d+) and end at (\d+)/);
        messageTypes.push({
            name: dictionary.descTypeMap.get(messageGroup[1]),
            start: messageGroup[2],
            end: messageGroup[3],
            description: messageGroup[1]
        });
        checkIfDictionaryEntryExists(messageGroup[1], filePath, dictionary.descTypeMap);
    }
    return messageTypes;
}

function parseSpecialTreatmentDirectionMessageTypes(data, dictionary, filepath) {
    var messageTypes = [];
    var messageTypesArray = data.match(/\/\/ (.*) start at (\d+)\./gm);
    for (var i = 0; i < messageTypesArray.length; ++i) {
        var messageGroup = messageTypesArray[i].match(/\/\/ (.*) start at (\d+)\./);
        messageTypes.push({
            name: dictionary.descTypeMap.get(messageGroup[1]),
            start: messageGroup[2],
            description: messageGroup[1]
        });
        checkIfDictionaryEntryExists(messageGroup[1], filepath, dictionary.descTypeMap);
    }
    return messageTypes;
}


function prepareSpecialTreatmentParser(messageTypes, directionMessageTypes, notParseable, dictionary) {
    var mesg = [];
    var directions = dictionary.directions;
    for (var i = 0; i < messageTypes.length; ++i) {
        var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
        _mesg.withDefault(new SingleMessageRecord(messageTypes[i].start, messageTypes[i].end));
        mesg.push(_mesg);
    }

    for (var i = 0; i < directionMessageTypes.length; ++i) {
        var _mesg = new FullMessage(directionMessageTypes[i].name, directionMessageTypes[i].description);
        for (var j = 0; j < directions.length; ++j) {
            _mesg.withDirection(directions[j], new SingleMessageRecord(parseInt(directionMessageTypes[i].start) + j * 10, parseInt(directionMessageTypes[i].start) + 9 + j * 10));
        }
        mesg.push(_mesg);
    }

    for (var i = 0; i < notParseable.length; ++i) {
        var _mesg = new FullMessage(dictionary.descTypeMap.get(notParseable[i].description), notParseable[i].description);
        _mesg.withDefault(new SingleMessageRecord(notParseable[i].start, notParseable[i].end));
        mesg.push(_mesg);
    }
    return mesg;
}

// *********
// HELPERS
// *********

function checkIfDictionaryEntryExists(entry, filename, dictionaryMap) {
    if (dictionaryMap.get(entry) === undefined) {
        console.log("DICTIONARY ENTRY: " + "\"" + entry + "\"" + " FROM FILE " + "\"" + filename + " IS MISSING");
    }
}

function writeToFile(obj, filePathAndName) {
    var fs = require('fs');
    fs.writeFile(filePathAndName, JSON.stringify(obj), function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file: " + filePathAndName + " was saved!");
    });
}

function readFile(filePathAndName) {
    var fs = require('fs');
    try {
        return fs.readFileSync(filePathAndName, {encoding: 'utf-8'});
    } catch (e) {
        console.log("Error while reading the file: " + filePathAndName);
        return null;
    }
}

function FullMessage(type, description) {
    this.type = type;
    this.description = description;
    this.classes = {};
    this.races = {};
    this.directions = {};
    this.default = [];

    this.withClass = function (name, obj) {
        this.classes[name] = obj;
    };

    this.withRace = function (name, obj) {
        this.races[name] = (obj);
    };

    this.withDirection = function (name, obj) {
        this.directions[name] = (obj);
    };

    this.withDefault = function (obj) {
        this.default.push(obj);
    }
}

function SingleMessageRecord(min, max) {
    this.min = min;
    this.max = max;
    this.lines = [];
}

// **************
// DICTIONARIES
// **************

function generateDictionary() {
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

function fetchUnparsableMessageTypes() {
    return [
        {description: "The NPC is dead and has Speak With Dead cast upon it.", start: 1500, end: 1599},
        {description: "The NPC will not follow the PC because the PC is too good", start: 1600, end: 1699},
        {description: "The NPC will not follow the PC because the PC is too evil", start: 1700, end: 1799},
        {description: "The NPC will not follow the PC because the NPC dislikes the PC", start: 1800, end: 1899},
        {description: "Good farewells (the NPC is neutral or happy with the PC)", start: 1900, end: 1999},
        {description: "Bad farewells (the NPC is suspicious or worse of the NPC)", start: 2000, end: 2099},
        {description: "NPC is acknowledging an order from the PC", start: 2100, end: 2199},
        {description: "NPC cannot acknowledge an order from the PC", start: 2200, end: 2299},
        {description: "NPC was accidentally hit by the PC", start: 2300, end: 2399},
        {description: "NPC witnesses PC critical hit", start: 2400, end: 2499},
        {description: "NPC witnesses PC critical miss", start: 2500, end: 2599},
        {
            description: "The NPC will not follow the PC because the NPC is already grouped with another PC who is at least as charismatic",
            start: 2600,
            end: 2699
        },
        {
            description: "The NPC will not follow the PC because the PC is at his charisma limit (which is greater zero)",
            start: 2700,
            end: 2799
        },
        {
            description: "The NPC will not follow the PC because the PCs charisma does not allow for followers",
            start: 2800,
            end: 2899
        },
        {description: "The NPC is too high level for the PC to be a follower", start: 2900, end: 2999},
        {description: "The NPC is fleeing from a combatant", start: 3000, end: 3099},
        {description: "gamble win messages", start: 3100, end: 3199},
        {description: "gamble lose messages", start: 3200, end: 3299},
        {description: "gambling pc things", start: 3300, end: 3399},
        {description: "gambling with low rank or training", start: 3400, end: 3499},
        {description: "gambling without enough money", start: 3500, end: 3599},
        {description: "gambling for what NPC is wearing", start: 3600, end: 3699},
        {description: "gambling for something the NPC really wants to keep", start: 3700, end: 3799},
        {description: "the NPC will not normally gamble, but is making an exception", start: 3800, end: 3899},
        {description: "the NPC makes a gamble offer", start: 3900, end: 3999},
        {description: "the NPC is warning the listener to stop what they are doing", start: 4000, end: 4099},
        {description: "the NPC is shouting about a newspaper he is selling", start: 4100, end: 4199},
        {description: "the NPC is asking the PC about buying newspapers", start: 4200, end: 4299},
        {description: "the NPC wants to sell a particular newspaper", start: 4300, end: 4399},
        {description: "the NPC has no older newspapers for sale", start: 4400, end: 4499},
        {description: "the NPC is offer older newspapers for sale", start: 4500, end: 4599},
        {description: "the NPC is refusing to buy stolen goods", start: 4600, end: 4699},
        {description: "the NPC is offering to use his skill and do the task for the PC leader", start: 4700, end: 4799},
        {description: "the NPC is upset that the PC is attacking party members", start: 4800, end: 4899},
        {description: "the NPC is upset the PC is attacking good creatures", start: 4900, end: 4999},
        {description: "the NPC is upset the PC is attacking townspeople from NPCs origin", start: 5000, end: 5099},
        {description: "the NPC is upset the PC is attacking faction buddies", start: 5100, end: 5199},
        {description: "the NPC is warning the PC he is becoming too good", start: 5200, end: 5299},
        {description: "the NPC is warning the PC he is becoming too evil", start: 5300, end: 5399},
        {description: "the NPC is warning the PC of low reaction to him", start: 5400, end: 5499},
        {description: "the NPC follower is nearing death", start: 5500, end: 5599},
        {description: "the NPC is not skilled in gambling", start: 5600, end: 5699},
        {
            description: "the NPC does not need to identify an item (as it is already identified)",
            start: 5700,
            end: 5799
        },
        {description: "the NPC wants money for identifying an item", start: 5800, end: 5899},
        {description: "the NPC cannot repair broken items", start: 5900, end: 5999},
        {description: "the NPC does not need to repair the item (it is not damaged)", start: 6000, end: 6099},
        {description: "the NPC wants money for repairing the item", start: 6100, end: 6199},
        {description: "PC doesnt have enough skill points to be trained as expert", start: 6200, end: 6299},
        {description: "PC doesnt have beginner training", start: 6300, end: 6399}
    ];
}

//************
// EXECUTION
//************

writeParserPatternForFiles(allFiles, "mes\\", "out\\", "parserPattern", false);