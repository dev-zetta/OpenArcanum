




module.exports = {
  //parent: 'middleWin',
  type: `window`,
  sprite: `Inventor`,
  position: `right-center`,
  visible: true,
  options: {
    toolbar: true,
    title: `Backpack Inventory`
  },

  listeners: {
    'topWin:created': () => {
      this.callComponent(`plugSlots`, `createSlots`)
      this.callComponent(`hotSlots`, `createSlots`)
    }
  },

  components: {
    sortBtn: {
      type: `button`,
      sprite: `LilGrnBut`,
      position: [405, 198]
    },
    takeBtn: {
      type: `button`,
      sprite: `UseBoxOFF`,
      position: [346, 300]
    },
    dropBtn: {
      type: `button`,
      sprite: `DropOFF`,
      position: [346, 350]
    },
    inventory: {
      type: `inventory`,
      position: [10, 8],
      size: [315, 377],
      style: { zIndex: 2 },
      options: {
        slotSize: 31,
        connectWith: [`hotSlots`, `plugSlots`]
      },
      listeners: {
        'sortBtn:click': () => {
          // get current dragged item
        },
        'dropBtn:click': () => {}
      },
      events: {
        created() {

          let test = {
            "Ammo": {
              "quantity": 10,
              "type": "Arrows"
            },
            "Base": {
              "armorClass": 0,
              "category": 1,
              "descIndex": 7038,
              "flags": [
                "Flat",
                "SeeThrough",
                "ShootThrough",
                "NoBlock"
              ],
              "health": {
                "adjustment": 0,
                "damage": 0,
                "points": 1
              },
              "location": [
                0,
                0
              ],
              "material": 2,
              "nameIndex": 2400,
              "offset": [
                0,
                0
              ],
              "prototype": 7058,
              "resistance": {
                "damage": 0,
                "electrical": 0,
                "fire": 0,
                "magic": 0,
                "poison": 0
              },
              "soundEffect": 0,
              "type": "Ammo"
            },
            "Item": {
              "aiAction": 0,
              "descriptionEffects": 7038,
              "descriptionUnknown": 7038,
              "discipline": 0,
              "invLocation": 0,
              "inventory": {
                "category": "Ammo",
                "display": "Inventory",
                "resource": "iArrows.ART",
                "subcat": "Arrows",
                "type": "Item"
              },
              "magicTechComplexity": 0,
              "magicWeightAdj": 0,
              "manaStore": 0,
              "spellManaStore": 0,
              "weight": 1,
              "worth": 1
            },
            "Visual": {
              "classes": {
                "current": {
                  "category": "Ammo",
                  "display": "Ground",
                  "resource": "garrows.ART",
                  "subcat": "Arrows",
                  "type": "Item"
                }
              },
              "light": {
                "color": "rgba(171, 171, 171, 171)",
                "flags": "00000000"
              },
              "render": {
                "alpha": 255,
                "color": "rgba(171, 171, 171, 171)",
                "scale": 100
              }
            }
          }


          this.addItems({
            test: {
              entity: test,
              size: [1, 2]
            },
            test2: {
              entity: test,
              size: [2, 2]
            },
            test3: {
              entity: test,
            },
            test4: {
              entity: test,
            },
            test5: {
              entity: test,
            },
            test6: {
              entity: test,
            }
          })
        }
      }
    }
  }
}
