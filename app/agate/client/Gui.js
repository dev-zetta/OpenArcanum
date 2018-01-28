import AGate from '../agate';

let Components = {
  "topWin": {
    "type": "window",
    "sprite": "IntTop",
    "align": "top-center",

    "components": {
      "characterBtn": {
        "type": "button",
        "position": [4, 2],
        "sprite": "CharBut",
      },
      "logbookBtn": {
        "type": "button",
        "position": [42, 2],
        "sprite": "LogBut",
      },
      "mapBtn": {
        "type": "button",
        "position": [78, 2],
        "sprite": "TMapBut", /* WMapBut */
      },
      "inventoryBtn": {
        "type": "button",
        "position": [116, 2],
        "sprite": "InvnBut",
      },
      "fateBtn": {
        "type": "button",
        "position": [154, 6],
        "sprite": "tinybutt",
      },
      "fatePoints": {
        "type": "text",
        "position": [190, 18]
      },


      "plugBtn1": {
        "type": "slot-button",
        "position": [281, 3],
        "sprite": "SPPlugged1",
      },
      "plugBtn2": {
        "type": "slot-button",
        "type": "button",
        "position": [331, 3],
        "sprite": "SPPlugged1",
      },
      "plugBtn3": {
        "type": "slot-button",
        "position": [381, 3],
        "sprite": "SPPlugged1",
      },
      "plugBtn4": {
        "type": "slot-button",
        "position": [431, 3],
        "sprite": "SPPlugged1",
      },
      "plugBtn5": {
        "type": "slot-button",
        "position": [481, 3],
        "sprite": "SPPlugged1",
      },


      "sleepBtn": {
        "type": "button",
        "position": [602, 6],
        "sprite": "tinybutt",
      },
      "timeProgress": {
        "type": "gauge",
        "position": [648, 6]
      }

    }
  }, /* topWin */

  "bottomWin": {
    "type": "window",
    "sprite": "IntBotom",
    "align": "bottom-center",

    "components": {
      "healthBar": {
        "type": "gauge",
        "position": [14, 31],
        "size": [26, 88],
      },
      "healthPoints": {
        "type": "text",
        "position": [15, 137]
      },
      "goldIcon": {
        "type": "icon",
        "position": [61, 68],
      },
      "goldNumber": {
        "type": "text",
        "position": [98, 68]
      },
      "combatBtn": {
        "type": "button",
        "position": [86, 16],
        "sprite": "CombatButton"
      },
      "lastSlot1": {
        "type": "slot-button",
        "position": [66, 104]
      },
      "lastSlot2": {
        "type": "slot-button",
        "position": [110, 104]
      },
      "spellBtn2": {
        "type": "button",
        "position": [166, 6],
        "sprite": "charSpellsSkills"
      },

      "hotSlot0": {
        "type": "slot-button",
        "position": [194, 4],
        "sprite": "HKSlt0"
      },
      "hotSlot1": {
        "type": "slot-button",
        "position": [238, 4],
        "sprite": "HKSlt1"
      },
      "hotSlot2": {
        "type": "slot-button",
        "position": [276, 4],
        "sprite": "HKSlt2"
      },
      "hotSlot3": {
        "type": "slot-button",
        "position": [316, 4],
        "sprite": "HKSlt3"
      },
      "hotSlot4": {
        "type": "slot-button",
        "position": [354, 4],
        "sprite": "HKSlt4"
      },

      "hotSlot5": {
        "type": "slot-button",
        "position": [418, 4],
        "sprite": "HKSlt5"
      },
      "hotSlot6": {
        "type": "slot-button",
        "position": [456, 4],
        "sprite": "HKSlt6"
      },
      "hotSlot7": {
        "type": "slot-button",
        "position": [496, 4],
        "sprite": "HKSlt7"
      },
      "hotSlot8": {
        "type": "slot-button",
        "position": [534, 4],
        "sprite": "HKSlt8"
      },
      "hotSlot9": {
        "type": "slot-button",
        "position": [574, 4],
        "sprite": "HKSlt9"
      },



      "skillsBtn": {
        "type": "button",
        "position": [694, 14],
        "sprite": "SkillsButton"
      },
      "spellBtn": {
        "type": "button",
        "position": [648, 52],
        "sprite": "SpellsButton"
      },
      "schemaBtn": {
        "type": "button",
        "position": [694, 98],
        "sprite": "SchematicsButton"
      },

      "fatigueBar": {
        "type": "gauge",
        "position": [756, 31],
        "size": [28, 88],
      },
      "fatiguePoints": {
        "type": "text",
        "position": [756, 138],
      }

    }
  } /* bottomWin */

};

class Sprite {
  constructor(key, json) {
    this.frames = [];

    let jsonFrames = json['frames'];
    for (let key in jsonFrames) {
      let jsonFrame = jsonFrames[key]['frame'];

      this.frames.push({
        left: jsonFrame.x,
        top: jsonFrame.y,
        width: jsonFrame.w,
        height: jsonFrame.h
      })

    }

    this.className = AGate.Utils.kebabCase(key);
  }

  getFrame(index = 0) {
    return this.frames[index];
  }

  hasFrame(index) {
    return index < this.frames.length;
  }

}

class Manager {
  constructor(engine) {
    this.engine = engine;
    this.sprites = {};
  }

  async loadAssets() {
    let assetLoader = this.engine.assetLoader;
    let guiPath = AGate.getDataPath('Interface');

    let files = await assetLoader.findFiles(guiPath, '.json');

    for (let i = 0; i < files.length; i++) {
      let jsonFile = files[i];

      let dotPos = jsonFile.lastIndexOf(".");
      let slashPos = jsonFile.lastIndexOf("/");
      let key = jsonFile.substring(slashPos + 1, dotPos);

      let json = await assetLoader.loadJsonFile(jsonFile);
      let sprite = new Sprite(key, json);

      this.sprites[key] = sprite;
    }
  }

  async generateAssets() {
    let targetCss = '/media/maxli/Data/dev/OpenArcanum/public/gui-images.css';

    let assetLoader = this.engine.assetLoader;
    let guiPath = AGate.getDataPath('Interface');

    let files = await assetLoader.findFiles(guiPath, '.json');

    for (let i = 0; i < files.length; i++) {
      let jsonFile = files[i];

      let dotPos = jsonFile.lastIndexOf(".");
      let imageFile = jsonFile.substr(0, dotPos) + ".gif";

      let slashPos = jsonFile.lastIndexOf("/");
      let key = jsonFile.substring(slashPos + 1, dotPos);
      key = AGate.Utils.kebabCase(key);

      assetLoader.preload({'key': key, 'type': 'atlas', 'texture': imageFile, 'data': jsonFile, 'output': 'base64'});
    }

    var css = "";
    await assetLoader.start((descriptor) => {
      //let sprite = {};
      //sprite.image.descriptor
      //let frames = descriptor.meta['frames'];

      css += `.${key} {background-image: url('${descriptor.image}');}\n`;

      this.sprites[key] = descriptor;
    });

    if (!AGate.Utils.isFileExist(targetCss))
    await assetLoader.saveTextFile(targetCss, css);
  }

  getSprite(key) {
    //key = AGate.Utils.kebabCase(key);
    return this.sprites[key];
  }

  getMouseElement() {
    if (!this.mouseElement) {
      this.mouseElement = $('#mouse-pointer');
      $(window).on('mousemove', (event) => {
        this.onMouseMove(event);
      });
    }

    return this.mouseElement;
  }

  onMouseMove(event) {
    let element = this.getMouseElement();

    element.offset({
      'top' : event.pageY,
      'left' : event.pageX
    });
  }

  setMouseSprite(key, index = 0) {
    let sprite = this.getSprite(key);

    if (!sprite)
      return;

    let frame = sprite.getFrame(index);

    let element = this.getMouseElement();

    element.addClass(sprite.className);
    element.css({
      'width': `${frame.width}px`,
      'height': `${frame.height}px`,
    });

    if (this.prevMouseClass)
      element.removeClass();

    this.prevMouseClass = sprite.className;
  }


}

Manager.Components = Components;

export { Manager };
