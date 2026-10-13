import readerHelper = require('../../helpers/ReaderHelper.cjs');
import dictionaries = require('../../resources/Dictionaries.cjs');
const dictionary = dictionaries.generalDialogue();
import type { DialogueFileInformation } from '../../types.cjs';
import RecordRange = require('../../classes/RecordRange.cjs');
import DialogueType = require('../../classes/DialogueType.cjs');

//* ************
// GENERATORS
//* ************

// GeneralDialoguesPatternCreator
/*
This generator creates a pattern for all given dialogue files which can be used later to parse dialogue records of those files in any language.
For every filename we are assigning a list of DIALOGUE TYPES

Methods:
writeParserPatternForFiles(
    fileInformation,
    inputFolder,
    outputFolder,
    parserFilename,
    writeAlsoToSingleFiles
  )
fileInformation: object with information about a file: name and how it should be parsed eg. {name: "gd_cls_dumb_f2f", type: "START_AT"} for more information check "FilesInformation.js"
inputFolder: where is main Arcanum folder placed eg "C:/Games/Arcanum"
inputFolder: where parsed JSON should be placed
parserFilename: how parser should be named
writeAlsoToSingleFiles: boolean if also single files should be created for every dialog file

--- DIALOGUE FILES PATTERN ---
{
  "filename": string,
  "dialogueTypes": [
    {DIALOGUE TYPE},
    {DIALOGUE TYPE}
  ]
}

Examples
{
	"filename": "justSomeDialogueFilename",
	"dialogueTypes": [{
			"type": "khajjitIsInnocentOfThisCrime",
			"description": "the NPC is refusing to buy stolen goods",
			"recordRanges": [{
					"context": "default" //default context
					"min": 4600,
					"max": 4699,
					"records": []
				}, {
					"context": "human" // race context
					"min": 4700,
					"max": 4799,
					"records": []
				}, {
					"context": "mage" // class context etc...
					"min": 4800,
					"max": 4899,
					"records": []
				},
			]
		}
	]
}

 */

export = {
  writeParserPatternForFiles: function (fileInformation: DialogueFileInformation[], inputFolder: string, outputFolder: string, parserFilename: string, writeAlsoToSingleFiles = false) {
    const generated: import("../../types.cjs").DialoguePattern[] = [];

    fileInformation.forEach((file) => {
      const data = generatePatternForSingleFile(inputFolder + file.name + '.mes', file);
      generated.push({filename: file.name, dialogueTypes: data});
      if (writeAlsoToSingleFiles) {
        readerHelper.writeJsonObjectToFile(data, outputFolder + file.name + '.json');
      }
    });
    readerHelper.writeJsonObjectToFile(generated, outputFolder + parserFilename);
  }
};

function generatePatternForSingleFile(filePath: string, file: DialogueFileInformation) {
  let data = readerHelper.readFile(filePath);
  if (data === null) return null;
  data = data.replace("Offers to train a beginner cannot", "Offers to train a beginner messages start at");
  data = data.replace("wants to start the WorldMap", "wants to start the WorldMap go between 2300 and 2399");
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
      return prepareStoryParser(parseStoryMessageTypes(data));
    default:
      console.log('Unknown file type: "' + file.type + '" for file: ' + file.name);
      break;
  }
}

// **********************
// CLASS MESSAGE PARSER
// **********************

function parseClassMessageTypes(data: string, filepath: string) {
  const messageTypes = [];
  const messageTypesArray = data.match(/\/\/ (.*) messages start at (\d+)./gm) || [];
  for (let i = 0; i < messageTypesArray.length; ++i) {
    const messageGroup = messageTypesArray[i].match(/\/\/ (.*) messages start at (\d+)./)!;
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

function prepareClassParser(messageTypes: ReturnType<typeof parseClassMessageTypes>) {
  const mesg = [];
  const classes = dictionary.classes;
  for (let i = 0; i < messageTypes.length; ++i) {
    const dialogueType = new DialogueType(messageTypes[i].name, messageTypes[i].description);
    for (let j = 0; j < classes.length; ++j) {
      dialogueType.addRange(
        new RecordRange(
          Number(messageTypes[i].jump) * j + parseInt(String(messageTypes[i].start)),
          Number(messageTypes[i].jump) * j + parseInt(String(messageTypes[i].start)) + parseInt(String(messageTypes[i].jump)) - 1,
          classes[j]
        )
      );
    }
    mesg.push(dialogueType);
  }
  return mesg;
}

// ***************************
// START AT DIALOGUE OPTIONS
// ***************************

function parseStartAtMessageTypes(data: string, filePath: string) {
  const messageTypes = [];
  const messageTypesArray = data.match(/\/\/ (.*) messages start at (\d+)./gm) || [];
  for (let i = 0; i < messageTypesArray.length; ++i) {
    const messageGroup = messageTypesArray[i].match(/\/\/ (.*) messages start at (\d+)./)!;
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

function parseStartAtParser(messageTypes: ReturnType<typeof parseStartAtMessageTypes>) {
  const mesg = [];
  for (let i = 0; i < messageTypes.length; ++i) {
    const dialogueType = new DialogueType(messageTypes[i].name, messageTypes[i].description);
    dialogueType.addRange(
      new RecordRange(
        parseInt(String(messageTypes[i].start)),
        parseInt(String(messageTypes[i].start)) + parseInt(String(messageTypes[i].jump)) - 1
      )
    );
    mesg.push(dialogueType);
  }
  return mesg;
}

// **************************
// BETWEEN DIALOGUE OPTIONS
// **************************

function parseBetweenMessageTypes(data: string, filePath: string) {
  const messageTypes = [];
  const messageTypesArray = data.match(/\/\/ (.*) between (\d+) and (\d+)/gm) || [];
  for (let i = 0; i < messageTypesArray.length; ++i) {
    const messageGroup = messageTypesArray[i].match(/\/\/ (.*) between (\d+) and (\d+)/)!;
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

function prepareBetweenParser(messageTypes: ReturnType<typeof parseBetweenMessageTypes>) {
  const mesg = [];
  for (let i = 0; i < messageTypes.length; ++i) {
    const dialogueType = new DialogueType(messageTypes[i].name, messageTypes[i].description);
    dialogueType.addRange(
      new RecordRange(
        parseInt(String(messageTypes[i].start)),
        parseInt(String(messageTypes[i].end))
      )
    );
    mesg.push(dialogueType);
  }
  return mesg;
}

// ************************
// RACES DIALOGUE OPTIONS
// ************************

function parseRacesMessageTypes(data: string, filepath: string) {
  const messageTypes = [];
  const messageTypesArray = data.match(/\/\/ (.*) messages start at (\d+). Each PC race gets (\d+)/gm) || [];
  for (let i = 0; i < messageTypesArray.length; ++i) {
    const messageGroup = messageTypesArray[i].match(/\/\/ (.*) messages start at (\d+). Each PC race gets (\d+)/)!;
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

function prepareRacesParser(messageTypes: ReturnType<typeof parseRacesMessageTypes>) {
  const mesg = [];
  const races = dictionary.races;
  for (let i = 0; i < messageTypes.length; ++i) {
    const dialogueType = new DialogueType(messageTypes[i].name, messageTypes[i].description);
    dialogueType.addRange(
      new RecordRange(
        messageTypes[i].start,
        parseInt(String(messageTypes[i].start)) + parseInt(String(messageTypes[i].jump)) - 1
      )
    );
    for (let j = 0; j < races.length; ++j) {
      dialogueType.addRange(
        new RecordRange(
          Number(messageTypes[i].jump) * j + parseInt(String(messageTypes[i].start)) + 50,
          Number(messageTypes[i].jump) * j + parseInt(String(messageTypes[i].start)) + parseInt(String(messageTypes[i].jump)) + 50 - 1,
          races[j]
        )
      );
    }
    mesg.push(dialogueType);
  }
  return mesg;
}

// ************************
// STORY DIALOGUE OPTIONS
// ************************

function parseStoryMessageTypes(data: string) {
  const messageTypes = [];
  const messageTypesArray = data.match(/\/\/ Story state is (\d+)/gm) || [];
  for (let i = 0; i < messageTypesArray.length; ++i) {
    const messageGroup = messageTypesArray[i].match(/\/\/ Story state is (\d+)/)!;
    messageTypes.push({
      name: 'storyState_' + messageGroup[1],
      jump: 100,
      description: 'Story state ' + messageGroup[1]
    });
  }
  return messageTypes;
}

function prepareStoryParser(messageTypes: ReturnType<typeof parseStoryMessageTypes>) {
  const mesg = [];
  const races = dictionary.races;
  for (let i = 0; i < messageTypes.length; ++i) {
    const dialogueType = new DialogueType(messageTypes[i].name, messageTypes[i].description);
    for (let j = 0; j < races.length; ++j) {
      dialogueType.addRange(
        new RecordRange(
          i * messageTypes[i].jump + j,
          i * messageTypes[i].jump + j,
          races[j]
        )
      );
    }
    mesg.push(dialogueType);
  }
  return mesg;
}

// **************************
// SPECIAL DIALOGUE OPTIONS
// **************************

function parseSpecialTreatmentMessageTypes(data: string, filePath: string) {
  const messageTypes = [];
  const messageTypesArray = data.match(/\/\/ (.*) messages start at (\d+) and end at (\d+)/gm) || [];
  for (let i = 0; i < messageTypesArray.length; ++i) {
    const messageGroup = messageTypesArray[i].match(/\/\/ (.*) messages start at (\d+) and end at (\d+)/)!;
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

function parseSpecialTreatmentDirectionMessageTypes(data: string, filepath: string) {
  const messageTypes = [];
  const messageTypesArray = data.match(/\/\/ (.*) start at (\d+)\./gm) || [];
  for (let i = 0; i < messageTypesArray.length; ++i) {
    const messageGroup = messageTypesArray[i].match(/\/\/ (.*) start at (\d+)\./)!;
    messageTypes.push({
      name: dictionary.descTypeMap.get(messageGroup[1]),
      start: messageGroup[2],
      description: messageGroup[1]
    });
    checkIfDictionaryEntryExists(messageGroup[1], filepath, dictionary.descTypeMap);
  }
  return messageTypes;
}

function prepareSpecialTreatmentParser(messageTypes: ReturnType<typeof parseSpecialTreatmentMessageTypes>, directionMessageTypes: ReturnType<typeof parseSpecialTreatmentDirectionMessageTypes>, notParseable: ReturnType<typeof fetchUnparsableMessageTypes>) {
  const mesg = [];
  const directions = dictionary.directions;
  for (let i = 0; i < messageTypes.length; ++i) {
    const _mesg = new DialogueType(messageTypes[i].name, messageTypes[i].description);
    _mesg.addRange(
      new RecordRange(messageTypes[i].start, messageTypes[i].end)
    );
    mesg.push(_mesg);
  }

  for (let j = 0; j < directionMessageTypes.length; ++j) {
    const _mesg = new DialogueType(
      directionMessageTypes[j].name,
      directionMessageTypes[j].description
    );
    for (let k = 0; k < directions.length; ++k) {
      _mesg.addRange(
        new RecordRange(
          parseInt(String(directionMessageTypes[j].start)) + k * 10,
          parseInt(String(directionMessageTypes[j].start)) + 9 + k * 10,
          directions[k]
        )
      );
    }
    mesg.push(_mesg);
  }

  for (let l = 0; l < notParseable.length; ++l) {
    const _mesg = new DialogueType(
      dictionary.descTypeMap.get(notParseable[l].description),
      notParseable[l].description
    );
    _mesg.addRange(
      new RecordRange(notParseable[l].start, notParseable[l].end)
    );
    mesg.push(_mesg);
  }
  return mesg;
}

// *********
// HELPERS
// *********

function checkIfDictionaryEntryExists(entry: string, filename: string, dictionaryMap: Map<string, string>) {
  if (dictionaryMap.get(entry) === undefined) {
    console.log('DICTIONARY ENTRY: ' + '"' + entry + '"' + ' FROM FILE ' + '"' + filename + ' IS MISSING');
  }
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
    {description: 'NPC is acknowledging an order from the PC', start: 2100, end: 2199},
    {
      description: 'NPC cannot acknowledge an order from the PC',
      start: 2200,
      end: 2299
    },
    {description: 'NPC was accidentally hit by the PC', start: 2300, end: 2399},
    {description: 'NPC witnesses PC critical hit', start: 2400, end: 2499},
    {description: 'NPC witnesses PC critical miss', start: 2500, end: 2599},
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
    {description: 'The NPC is fleeing from a combatant', start: 3000, end: 3099},
    {description: 'gamble win messages', start: 3100, end: 3199},
    {description: 'gamble lose messages', start: 3200, end: 3299},
    {description: 'gambling pc things', start: 3300, end: 3399},
    {description: 'gambling with low rank or training', start: 3400, end: 3499},
    {description: 'gambling without enough money', start: 3500, end: 3599},
    {description: 'gambling for what NPC is wearing', start: 3600, end: 3699},
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
    {description: 'the NPC makes a gamble offer', start: 3900, end: 3999},
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
    {description: 'the NPC has no older newspapers for sale', start: 4400, end: 4499},
    {description: 'the NPC is offer older newspapers for sale', start: 4500, end: 4599},
    {description: 'the NPC is refusing to buy stolen goods', start: 4600, end: 4699},
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
    {description: 'the NPC follower is nearing death', start: 5500, end: 5599},
    {description: 'the NPC is not skilled in gambling', start: 5600, end: 5699},
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
    {description: 'the NPC cannot repair broken items', start: 5900, end: 5999},
    {
      description: 'the NPC does not need to repair the item (it is not damaged)',
      start: 6000,
      end: 6099
    },
    {description: 'the NPC wants money for repairing the item', start: 6100, end: 6199},
    {
      description: 'PC doesnt have enough skill points to be trained as expert',
      start: 6200,
      end: 6299
    },
    {description: 'PC doesnt have beginner training', start: 6300, end: 6399}
  ];
}
