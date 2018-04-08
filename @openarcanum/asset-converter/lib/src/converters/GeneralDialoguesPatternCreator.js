const readerHelper = require('../helpers/ReaderHelper');
const dictionary = require('../resources/Dictionaries').generalDialogue();

//* ************
// GENERATORS
//* ************
module.exports = {
  writeParserPatternForFiles: function writeParserPatternForFiles(
    files,
    inputFolder,
    outputFolder,
    parserFilename,
    writeAlsoToSingleFiles
  ) {
    var generated = {};

    for (var fileName in files) {
      var file = files[fileName];
      generated[file.name] = generatePatternForSingleFile(
        inputFolder + file.name + '.mes',
        file
      );
      if (writeAlsoToSingleFiles) {
        readerHelper.writeJsonObjectToFile(generated, outputFolder + file.name + '.json');
      }
    }
    readerHelper.writeJsonObjectToFile(generated, outputFolder + parserFilename);
  },
  generatePatternForSingleFile: function(file, inputFolder, outputFolder) {
    var generated = generatePatternForSingleFile(inputFolder + file.name + '.mes', file);
    readerHelper.writeJsonObjectToFile(generated, outputFolder + file.name + '.json');
  }
};

function generatePatternForSingleFile(filePath, file) {
  var data = readerHelper.readFile(filePath);
  if (data === null) {
    return null;
  }
  switch (file.type) {
    case 'START_AT':
      return parseStartAtParser(parseStartAtMessageTypes(data, file.name));
    case 'BETWEEN':
      return prepareBetweenParser(parseBetweenMessageTypes(data, file.name));
    case 'CLASS':
      return prepareClassParser(parseClassMessageTypes(data, file.name));
    case 'RACE':
      return prepareRacesParser(parseRacesMessageTypes(data, file.name));
    case 'SPECIAL':
      return prepareSpecialTreatmentParser(
        parseSpecialTreatmentMessageTypes(data, file.name),
        parseSpecialTreatmentDirectionMessageTypes(data, file.name),
        fetchUnparsableMessageTypes()
      );
    case 'STORY':
      return prepareStoryParser(parseStoryMessageTypes(data, file.name));
    default:
      console.log('Unknown file type: "' + file.type + '" for file: ' + file.name);
      break;
  }
}

// **********************
// CLASS MESSAGE PARSER
// **********************

function parseClassMessageTypes(data, filepath) {
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

function prepareClassParser(messageTypes) {
  var mesg = [];
  var classes = dictionary.classes;
  for (var i = 0; i < messageTypes.length; ++i) {
    var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
    for (var j = 0; j < classes.length; ++j) {
      _mesg.withClass(
        classes[j],
        new SingleMessageRecord(
          messageTypes[i].jump * j + parseInt(messageTypes[i].start),
          messageTypes[i].jump * j +
            parseInt(messageTypes[i].start) +
            parseInt(messageTypes[i].jump) -
            1
        )
      );
    }
    mesg.push(_mesg);
  }
  return mesg;
}

// ***************************
// START AT DIALOGUE OPTIONS
// ***************************

function parseStartAtMessageTypes(data, filePath) {
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
    _mesg.withDefault(
      new SingleMessageRecord(
        parseInt(messageTypes[i].start),
        parseInt(messageTypes[i].start) + parseInt(messageTypes[i].jump) - 1
      )
    );
    mesg.push(_mesg);
  }
  return mesg;
}

// **************************
// BETWEEN DIALOGUE OPTIONS
// **************************

function parseBetweenMessageTypes(data, filePath) {
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
    _mesg.withDefault(
      new SingleMessageRecord(
        parseInt(messageTypes[i].start),
        parseInt(messageTypes[i].end)
      )
    );
    mesg.push(_mesg);
  }
  return mesg;
}

// ************************
// RACES DIALOGUE OPTIONS
// ************************

function parseRacesMessageTypes(data, filepath) {
  var messageTypes = [];
  var messageTypesArray = data.match(
    /\/\/ (.*) messages start at (\d+). Each PC race gets (\d+)/gm
  );
  for (var i = 0; i < messageTypesArray.length; ++i) {
    var messageGroup = messageTypesArray[i].match(
      /\/\/ (.*) messages start at (\d+). Each PC race gets (\d+)/
    );
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

function prepareRacesParser(messageTypes) {
  var mesg = [];
  var races = dictionary.races;
  for (var i = 0; i < messageTypes.length; ++i) {
    var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
    _mesg.withDefault(
      new SingleMessageRecord(
        messageTypes[i].start,
        parseInt(messageTypes[i].start) + parseInt(messageTypes[i].jump) - 1
      )
    );
    for (var j = 0; j < races.length; ++j) {
      _mesg.withRace(
        races[j],
        new SingleMessageRecord(
          messageTypes[i].jump * j + parseInt(messageTypes[i].start) + 50,
          messageTypes[i].jump * j +
            parseInt(messageTypes[i].start) +
            parseInt(messageTypes[i].jump) +
            50 -
            1
        )
      );
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
      name: 'storyState_' + messageGroup[1],
      jump: 100,
      description: 'Story state ' + messageGroup[1]
    });
  }
  return messageTypes;
}

function prepareStoryParser(messageTypes) {
  var mesg = [];
  var races = dictionary.races;
  for (var i = 0; i < messageTypes.length; ++i) {
    var _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
    for (var j = 0; j < races.length; ++j) {
      _mesg.withRace(
        races[j],
        new SingleMessageRecord(
          i * messageTypes[i].jump + j,
          i * messageTypes[i].jump + j
        )
      );
    }
    mesg.push(_mesg);
  }
  return mesg;
}

// **************************
// SPECIAL DIALOGUE OPTIONS
// **************************

function parseSpecialTreatmentMessageTypes(data, filePath) {
  var messageTypes = [];
  var messageTypesArray = data.match(
    /\/\/ (.*) messages start at (\d+) and end at (\d+)/gm
  );
  for (var i = 0; i < messageTypesArray.length; ++i) {
    var messageGroup = messageTypesArray[i].match(
      /\/\/ (.*) messages start at (\d+) and end at (\d+)/
    );
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

function parseSpecialTreatmentDirectionMessageTypes(data, filepath) {
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

function prepareSpecialTreatmentParser(
  messageTypes,
  directionMessageTypes,
  notParseable
) {
  var mesg = [];
  var directions = dictionary.directions;
  var _mesg;
  for (var i = 0; i < messageTypes.length; ++i) {
    _mesg = new FullMessage(messageTypes[i].name, messageTypes[i].description);
    _mesg.withDefault(
      new SingleMessageRecord(messageTypes[i].start, messageTypes[i].end)
    );
    mesg.push(_mesg);
  }

  for (var j = 0; j < directionMessageTypes.length; ++j) {
    _mesg = new FullMessage(
      directionMessageTypes[j].name,
      directionMessageTypes[j].description
    );
    for (var k = 0; k < directions.length; ++k) {
      _mesg.withDirection(
        directions[k],
        new SingleMessageRecord(
          parseInt(directionMessageTypes[j].start) + k * 10,
          parseInt(directionMessageTypes[j].start) + 9 + k * 10
        )
      );
    }
    mesg.push(_mesg);
  }

  for (var l = 0; l < notParseable.length; ++l) {
    _mesg = new FullMessage(
      dictionary.descTypeMap.get(notParseable[l].description),
      notParseable[l].description
    );
    _mesg.withDefault(
      new SingleMessageRecord(notParseable[l].start, notParseable[l].end)
    );
    mesg.push(_mesg);
  }
  return mesg;
}

// *********
// HELPERS
// *********

function checkIfDictionaryEntryExists(entry, filename, dictionaryMap) {
  if (dictionaryMap.get(entry) === undefined) {
    console.log(
      'DICTIONARY ENTRY: ' +
        '"' +
        entry +
        '"' +
        ' FROM FILE ' +
        '"' +
        filename +
        ' IS MISSING'
    );
  }
}

function FullMessage(type, description) {
  this.type = type;
  this.description = description;
  this.classes = {};
  this.races = {};
  this.directions = {};
  this.default = [];

  this.withClass = function(name, obj) {
    this.classes[name] = obj;
  };

  this.withRace = function(name, obj) {
    this.races[name] = obj;
  };

  this.withDirection = function(name, obj) {
    this.directions[name] = obj;
  };

  this.withDefault = function(obj) {
    this.default.push(obj);
  };
}

function SingleMessageRecord(min, max) {
  this.min = min;
  this.max = max;
  this.lines = [];
}

// **************
// DICTIONARIES
// **************

function fetchUnparsableMessageTypes() {
  return [
    {
      description: 'The NPC is dead and has Speak With Dead cast upon it.',
      start: 1500,
      end: 1599
    },
    {
      description: 'The NPC will not follow the PC because the PC is too good',
      start: 1600,
      end: 1699
    },
    {
      description: 'The NPC will not follow the PC because the PC is too evil',
      start: 1700,
      end: 1799
    },
    {
      description: 'The NPC will not follow the PC because the NPC dislikes the PC',
      start: 1800,
      end: 1899
    },
    {
      description: 'Good farewells (the NPC is neutral or happy with the PC)',
      start: 1900,
      end: 1999
    },
    {
      description: 'Bad farewells (the NPC is suspicious or worse of the NPC)',
      start: 2000,
      end: 2099
    },
    { description: 'NPC is acknowledging an order from the PC', start: 2100, end: 2199 },
    {
      description: 'NPC cannot acknowledge an order from the PC',
      start: 2200,
      end: 2299
    },
    { description: 'NPC was accidentally hit by the PC', start: 2300, end: 2399 },
    { description: 'NPC witnesses PC critical hit', start: 2400, end: 2499 },
    { description: 'NPC witnesses PC critical miss', start: 2500, end: 2599 },
    {
      description:
        'The NPC will not follow the PC because the NPC is already grouped with another PC who is at least as charismatic',
      start: 2600,
      end: 2699
    },
    {
      description:
        'The NPC will not follow the PC because the PC is at his charisma limit (which is greater zero)',
      start: 2700,
      end: 2799
    },
    {
      description:
        'The NPC will not follow the PC because the PCs charisma does not allow for followers',
      start: 2800,
      end: 2899
    },
    {
      description: 'The NPC is too high level for the PC to be a follower',
      start: 2900,
      end: 2999
    },
    { description: 'The NPC is fleeing from a combatant', start: 3000, end: 3099 },
    { description: 'gamble win messages', start: 3100, end: 3199 },
    { description: 'gamble lose messages', start: 3200, end: 3299 },
    { description: 'gambling pc things', start: 3300, end: 3399 },
    { description: 'gambling with low rank or training', start: 3400, end: 3499 },
    { description: 'gambling without enough money', start: 3500, end: 3599 },
    { description: 'gambling for what NPC is wearing', start: 3600, end: 3699 },
    {
      description: 'gambling for something the NPC really wants to keep',
      start: 3700,
      end: 3799
    },
    {
      description: 'the NPC will not normally gamble, but is making an exception',
      start: 3800,
      end: 3899
    },
    { description: 'the NPC makes a gamble offer', start: 3900, end: 3999 },
    {
      description: 'the NPC is warning the listener to stop what they are doing',
      start: 4000,
      end: 4099
    },
    {
      description: 'the NPC is shouting about a newspaper he is selling',
      start: 4100,
      end: 4199
    },
    {
      description: 'the NPC is asking the PC about buying newspapers',
      start: 4200,
      end: 4299
    },
    {
      description: 'the NPC wants to sell a particular newspaper',
      start: 4300,
      end: 4399
    },
    { description: 'the NPC has no older newspapers for sale', start: 4400, end: 4499 },
    { description: 'the NPC is offer older newspapers for sale', start: 4500, end: 4599 },
    { description: 'the NPC is refusing to buy stolen goods', start: 4600, end: 4699 },
    {
      description:
        'the NPC is offering to use his skill and do the task for the PC leader',
      start: 4700,
      end: 4799
    },
    {
      description: 'the NPC is upset that the PC is attacking party members',
      start: 4800,
      end: 4899
    },
    {
      description: 'the NPC is upset the PC is attacking good creatures',
      start: 4900,
      end: 4999
    },
    {
      description: 'the NPC is upset the PC is attacking townspeople from NPCs origin',
      start: 5000,
      end: 5099
    },
    {
      description: 'the NPC is upset the PC is attacking faction buddies',
      start: 5100,
      end: 5199
    },
    {
      description: 'the NPC is warning the PC he is becoming too good',
      start: 5200,
      end: 5299
    },
    {
      description: 'the NPC is warning the PC he is becoming too evil',
      start: 5300,
      end: 5399
    },
    {
      description: 'the NPC is warning the PC of low reaction to him',
      start: 5400,
      end: 5499
    },
    { description: 'the NPC follower is nearing death', start: 5500, end: 5599 },
    { description: 'the NPC is not skilled in gambling', start: 5600, end: 5699 },
    {
      description:
        'the NPC does not need to identify an item (as it is already identified)',
      start: 5700,
      end: 5799
    },
    {
      description: 'the NPC wants money for identifying an item',
      start: 5800,
      end: 5899
    },
    { description: 'the NPC cannot repair broken items', start: 5900, end: 5999 },
    {
      description: 'the NPC does not need to repair the item (it is not damaged)',
      start: 6000,
      end: 6099
    },
    { description: 'the NPC wants money for repairing the item', start: 6100, end: 6199 },
    {
      description: 'PC doesnt have enough skill points to be trained as expert',
      start: 6200,
      end: 6299
    },
    { description: 'PC doesnt have beginner training', start: 6300, end: 6399 }
  ];
}
