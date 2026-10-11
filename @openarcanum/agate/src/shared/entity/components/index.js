import Base from './Base'
import Wall from './Wall'
import Spell from './Spell'
import Critter from './Critter'
import Npc from './Npc'
import Visual from './Visual'
import Ammo from './Ammo'
import Item from './Item'
import Armor from './Armor'
import Portal from './Portal'
import Container from './Container'
import Scenery from './Scenery'
import Projectile from './Projectile'
import Weapon from './Weapon'
import Gold from './Gold'
import Key from './Key'
import Written from './Written'
import Generic from './Generic'
import Trap from './Trap'
import Pc from './Pc'

const Components = {
  Wall,
  Spell,
  Portal,
  Container,
  Scenery,
  Projectile,
  Weapon,
  Ammo,
  Armor,
  Gold,
  //Food,
  //Scroll,
  Key,
  //Keyring,
  Written,
  Generic,
  Pc,
  Npc,
  Trap,

  Base,
  Critter,
  Visual,
  Item
}

// Component identities come from the converted-data schema. Bundlers may
// rename JavaScript classes (Wall -> Wall2), so constructor.name is not a
// stable key for ECS properties or prototype inheritance.
for (const name of Object.keys(Components)) {
  Components[name].componentName = name
}

export default Components
