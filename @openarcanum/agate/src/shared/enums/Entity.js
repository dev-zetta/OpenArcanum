import Enum from '../misc/Enum'

export const Entity = new Enum([
  `Wall`,
  `Portal`,
  `Container`,
  `Scenery`,
  `Projectile`,
  `Weapon`,
  `Ammo`,
  `Armor`,
  `Gold`,
  `Food`,
  `Scroll`,
  `Key`,
  `Keyring`,
  `Written`,
  `Generic`,
  `Pc`,
  `Npc`,
  `Trap`
])

export const AiState = new Enum([
  `PreparingToAttack`,
  `Attacking`,
  `Moving`,
  `MovingToWaypoint`,
  `PlanningToMove`
])

export const SpriteState = new Enum([
  `Current`,
  `Normal`,
  `Destroyed`,
  `Light`,
  `Shadow`
])

export const Direction = new Enum([
  `North`,
  `NorthEast`,
  `East`,
  `SouthEast`,
  `South`,
  `SouthWest`,
  `West`,
  `NorthWest`
])

export const Wall = new Enum([
  `RawBrick`,
  `DarkWood`,
  `Interior1`,
  `Interior2`,
  `LightWood`,
  `Victorian`,
  `WoodShack`,
  `VictorianWood`,
  `Dungeon`,
  `Rock`,
  `Cave`,
  `Rock2`,
  `RedBrick`,
  `GreyBrick`,
  `BeigeBrick`,
  `Interior4`,
  `Interior5`,
  `Sewers`,
  `Castle`,
  `Village`,

  `SeasideVillageExterior`,
  `SeasideVillageInterior`,
  `Fake`,
  `Dummy`, // For unique portals
  `Panrii`,
  `Dwarf`,
  `RotIronFence`,
  `Trees`,
  `StoneVillage`,
  `DwarfCaves`,
  `DwarfDwellings`,
  `Tulla`,
  `TullaInterior`,
  `Tulla Wall`,
  `VendigrothExterior`,
  `VendigrothInterior`,
  `VendigrothCaves`,
  `GreyCaves`,
  `NewDungeons`,
  `Ruins`,
  `Prison`,
  `Void`,
  `JungleTrees`
])

export const WallType = new Enum([
  `Base`,

  `LeftCorner`,

  `BottomLeftCorner`,
  `BottomRightCorner`,

  `TopLeftCorner`,
  `TopRightCorner`,

  `UpperEndcap`,
  `LowerEndcap`,

  `Window3Left`,
  `Window3A`,
  `Window3Right`,

  `Window4Left`,
  `Window4A`,
  `Window4B`,
  `Window4Right`,

  `Window5Left`,
  `Window5A`,
  `Window5B`,
  `Window5C`,
  `Window5Right`,

  `Doorway3Left`,
  `Doorway3A`,
  `Doorway3Right`,

  `Doorway4Left`,
  `Doorway4A`,
  `Doorway4B`,
  `Doorway4Right`,

  `Doorway6Left`,
  `Doorway6A`,
  `Doorway6B`,
  `Doorway6C`,
  `Doorway6D`,
  `Doorway6Right`,

  `Kitchen3Left`,
  `Kitchen3A`,
  `Kitchen3Right`,

  `Kitchen4Left`,
  `Kitchen4A`,
  `Kitchen4B`,
  `Kitchen4Right`,

  `Kitchen5Left`,
  `Kitchen5A`,
  `Kitchen5B`,
  `Kitchen5C`,
  `Kitchen5Right`
])

export const WallSide = new Enum([`Universal`, `Left`, `Right`])

export const TileName = new Enum([
  // Outdoor flippable tile names start here, at 0
  `Dirt`,
  `Grass`,
  `RockyGround`,
  `Snow`,
  `DeadGrass1`,
  `BogShore1`,
  `BogShore2`,
  `BogWater`,
  `ShallowWater1`,
  `ShallowWater2`,
  `ShallowWater3`,
  `ShallowWater`,
  `DeepWater`,
  `SolidRock`,
  `SideWalk1`,
  `SideWalk2`,
  `Street1`,
  `OutdoorWoodPlanks`,
  `Desert`,
  `ShallowSand`,
  `DesertIsland`,
  `JungleDirt`,
  `JungleGrass`,
  `SeaWall`,
  `OutdoorSewer`,
  `TarantStreet1`,
  `TarantStreet2`,
  `TorddedDirt`,
  `BlackYall`,
  `VoidDirt`,
  `VoidFog`,

  // 31 - Outdoor non-flippable tile names start here, at 100
  `Test`,
  `Prh`,
  `Docks`,
  `TullaWalkways`,
  `VWK`,
  `Ice`,

  // 31 + 6 Indoor flippable tile names start here, at 200
  `Fl1`,
  `Wod`,

  // 31 + 6 + 2 Indoor non-flippable tile names start here, at 300
  `Dungeon1`, // Dn1
  `WI1`,
  `Dungeon2`,
  `CavernFloor1`,
  `WD1`,
  `SewerWaterFloor`,
  `DarkWoodFloors`,
  `IllegalTiles`,
  `DirtIndoorFloor`,
  `CavernFloor2`,
  `DungeonFloors`,
  `VoidFloors`,
  `JungleDirtInside`,
  `Base`
])

export const EyeCandyLayer = new Enum([`Foreground`, `Background`, `Underlay`])

export const ItemDisplay = new Enum([
  `Ground`,
  `Inventory`,
  `Paper`,
  `Schematic`
])

export const PortalType = new Enum([
  // Doors
  `Brick1`,
  `Brick2Interior`,
  `Shack`,
  `Wood1`,
  `Wood1Interior`,
  `Victorian`,
  `Victorian2`,
  `Dungeon1`,
  `Brick1Interior`,
  `Brick2Building`,
  `GreyBlock`,
  `BeigeBlock`,
  `Interior5`,
  `Interior4`,
  `Brick2`,
  `Village`,
  `SeaSideVillageExterior`,
  `SeasideVillageInterior`,
  `ShroudedHillsGate`,
  `PanriiSingleWide`,
  `ElvenHut1`,
  `RotIron`,
  `CavePrison`,
  `StoneVillage`,
  `DwarfDwelling`,
  `TullaExterior`,
  `TullaInterior`,
  `VendigrothExterior`,
  `VendigrothInterior`,
  `Dungeon`,
  `Prison`,
  `Void`,

  // Windows
  `Brick1`,
  `Brick1Interior`,
  `Brick2Interior`,
  `Shack`,
  `Wood1`,
  `Wood1Interior`,
  `Victorian`,
  `VictorianInterior`,
  `Dungeon1`,
  `Brick2Building`,
  `GreyBlock`,
  `BeigeBlock`,
  `Interior5`,
  `Interior4`,
  `Sewer`,
  `Village`,
  `SeaSideVillageExterior`,
  `SeaSideVillageInterior`,
  `CavePrisonBars`,
  `StoneVillage`,
  `DwarvenDwelling`,
  `TullaExterior`,
  `TullaInterior`,
  `Prison`
])

export const MonsterSpecie = new Enum([
  `Wolf`,
  `Spider`,
  `Orc`,
  `EarthElemental`,
  `LesserDemon`,
  `LesserSkeleton`,
  `LesserZombie`,
  `LesserMummy`,
  `GreaterDemon`,
  `Bunny`,
  `MechanicalSpider`,
  `Automaton`,
  `LizardMan`,
  `PhantomKnight`,
  `WereRat`,
  `SnakeMan`,
  `Ape`,
  `Bear`,
  `Chicken`,
  `Cougar`,
  `Sheep`,
  `Tiger`,
  `Pig`,
  `Cow`,
  `WillOWisp`,
  `MutantPig`,
  `FireElemental`,
  `WaterElemental`,
  `AirElemental`,
  `DeathKnight`,
  `SpiderQueen`,
  `Werewolf`
])

export const UniqueNpc = new Enum([
  `HumanBarbarian`,
  `HumanTownsperson`,
  `HumanVillager`,
  `GnomeVillager`,
  `HumanKing`,
  `DeadGnome`,
  `HumanOldman`,
  `ElvenVillager`,
  `ElvenFemaleVillager`,
  `GnomeVillager2`,
  `GnomeFemaleVillager`,
  `HumanFemaelVillager`,
  `DwarfMaleVillager`,
  `SilverLady`,
  `RobedMale`,
  `HumanPriest`,
  `GnomeFemaleCityDweller`,
  `HumanFemaleCityDweller`,
  `ClockworkDecoy`,
  `Arraya`,
  `Dragon`,
  `Gorwrath`,
  `HellBeast`,
  `Kite`,
  `Krag`,
  `Lycanthrope`,
  `SnakeMan`,
  `Kerghan1`,
  `Kerghan2`,
  `Kerghan3`,
  `Kerghan4`,
  `ShamblerMonster`,
  `GolemMonster`,
  `Familiar`,
  `PhantomKnight1`,
  `PhantomKnight2`,
  `PhantomKnight3`,
  `StillwaterGiant`,
  `NakedHalfling`,
  `VoormanMonster`
])

export const Armor = new Enum([
  `Underwear`,
  `Villager`,
  `Leather`,
  `ChainMail`,
  `PlateMail`,
  `Robe`,
  `PlateClassic`,
  `Barbarian`,
  `CityDweller`,
  `NoArmor`
])

export const Weapon = new Enum([
  `Unarmed`,
  `Default`,
  `Dagger`,
  `Sword`,
  `Axe`,
  `Mace`,
  `Pistol`,
  `Longsword`,
  `Bow`,
  `Unknown1`,
  `TechGun`,
  `Unknown2`,
  `Unknown3`,
  `Staff`,
  `Unknown4`
])

export const EntitySource = new Enum([
  `Mobile`,
  `Prototype`,
  `Savegame`,
  `Character`
])

export const SpellCollege = new Enum([
  `Conveyance`,
  `Divination`,
  `Air`,
  `Earth`,
  `Fire`,
  `Water`,
  `Force`,
  `Mental`,
  `Meta`,
  `Morph`,
  `Nature`,
  `NecroEvil`,
  `NecroGood`,
  `Phantasm`,
  `Summoning`,
  `Temporal`
])

export const Spell = new Enum([
  `Disarm`,
  `UnlockingCantrip`,
  `UnseenForce`,
  `SpatialDistortion`,
  `Teleportation`,
  `SenseAlignment`,
  `SeeContents`,
  `ReadAura`,
  `SenseHidden`,
  `DivineMagick`,
  `VitalityOfAir`,
  `PoisonVapours`,
  `CallWinds`,
  `BodyOfAir`,
  `CallAirElemental`,
  `StrengthOfEarth`,
  `StoneThrow`,
  `WallOfStone`,
  `BodyOfStone`,
  `CallEarthElemental`,
  `AgilityOfFire`,
  `WallOfFire`,
  `Fireflash`,
  `BodyOfFire`,
  `CallFireElemental`,
  `PurityOfWater`,
  `CallFog`,
  `SquallOfIce`,
  `BodyOfWater`,
  `CallWaterElemental`,
  `ShieldOfProtection`,
  `Jolt`,
  `WallOfForce`,
  `BoltOfLightning`,
  `Disintegrate`,
  `Charm`,
  `Stun`,
  `DrainWill`,
  `Nightmare`,
  `DominateWill`,
  `ResistMagick`,
  `DisperseMagick`,
  `DweomerShield`,
  `BondsOfMagick`,
  `ReflectionShield`,
  `HardenedHands`,
  `Weaken`,
  `Shrink`,
  `FleshToStone`,
  `SpPolymorph`,
  `CharmBeast`,
  `Entangle`,
  `ControlBeast`,
  `SuccourBeast`,
  `Regenerate`,
  `Harm`,
  `ConjureSpirit`,
  `SummonUndead`,
  `CreateUndead`,
  `QuenchLife`,
  `MinorHealing`,
  `HaltPoison`,
  `MajorHealing`,
  `Sanctuary`,
  `Resurrect`,
  `Illuminate`,
  `Flash`,
  `BlurSight`,
  `PhantasmalFiend`,
  `Invisibility`,
  `PlagueOfInsects`,
  `OrcishChampion`,
  `GuardianOgre`,
  `Hellgate`,
  `Familiar`,
  `Magelock`,
  `CongealTime`,
  `Hasten`,
  `Stasis`,
  `TempusFugit`
])

export const Skill = new Enum([
  `Bow`,
  `Dodge`,
  `Melee`,
  `Throwing`,
  `Backstab`,
  `Pickpocket`,
  `Prowling`,
  `SpotTrap`,
  `Gambling`,
  `Haggle`,
  `Heal`,
  `Persuasion`,
  `Repair`,
  `Firearms`,
  `Picklock`,
  `DisarmTrap`
])

export const Damage = new Enum([
  `Normal`,
  `Poison`,
  `Electrical`,
  `Fire`,
  `Fatigue`
])

export const QuestState = new Enum([
  `Unknown`,
  `Mentioned`,
  `Accepted`,
  `Achieved`,
  `Completed`,
  `Other`,
  `Botched`
])

export const SocialClass = new Enum([
  `Noble`,
  `Priest`,
  `Wizard`,
  `Technologist`,
  `Shopkeeper`,
  `Guard`,
  `CityDweller`,
  `Villager`,
  `Beggar`,
  `Thief`,
  `Bandit`
])

export const EffectCause = new Enum([
  `Race`,
  `Background`,
  `Class`,
  `Bless`,
  `Curse`,
  `Item`,
  `Spell`,
  `Injury`,
  `Tech`,
  `Gender`
])

export const ArmorCoverage = new Enum([
  `Torso`,
  `Shield`,
  `Helmet`,
  `Gauntlets`,
  `Boots`,
  `Ring`,
  `Medallion`
])

export const Container = new Enum([
  `JunkPile`,
  `Chest`,
  `Barrel`,
  `Bag`,
  `Box`,
  `Furniture`,
  `Bookstand`,
  `Misc`
])

export const ContainerState = new Enum([
  `Unlocked`,
  `Locked`,
  `UnlockedPermanently`
])

export const Item = new Enum([
  `Weapon`,
  `Ammo`,
  `Armor`,
  `Gold`,
  `Food`,
  `Scroll`,
  `Key`,
  `KeyRing`,
  `Written`,
  `Generic`
])

export const Gender = new Enum([`Male`, `Female`])

export const Shield = new Enum([`ShieldNone`, `ShieldAttached`])

export const Race = new Enum([
  `Human`,
  `Dwarf`,
  `Elf`,
  `HalfElf`,
  `Gnome`,
  `Halfing`,
  `HalfOrc`,
  `HalfOgre`,
  `DarkElf`,
  `Ogre`,
  `Orc`,

  `Undead`,
  `Animal`,
  `Monster`
])

export const Animation = new Enum([
  `Stand`,
  `Walk`,
  `KickLow`,
  `StealthWalk`,
  `Disassemble`,
  `ConcealFidget`,
  `Run`,
  `FallDown`,
  `GetUp`,
  `KneelDown`,
  `KneelMagicHands`,
  `FallOverFromKneel`,
  `Pickpocket`,
  `Vault`,
  `Throw`,
  `Unknown4`,
  `Unknown5`,
  `Decapitation`,
  `BlownOut`,
  `SeveredLeg`,
  `Attack`,
  `AttackLow`,
  `Unknown6`,
  `Stunned`,
  `Explode`,
  `Special`
])

export const HitChart = new Enum([
  `Cutting`,
  `Crushing`,
  `Impaling`,
  `Electrical`,
  `Fire`
])

export const MissChart = new Enum([
  `Bladed`,
  `Bludgeon`,
  `Handled`,
  `Guns`,
  `Bows`,
  `Hands`,
  `Explosive`,
  `Fire`,
  `Electrical`
])

export const BodyType = new Enum([
  `Biped`,
  `Quadruped`,
  `Amorphous`,
  `Insect`,
  `Snake`,
  `Avian`
])

export const Reaction = new Enum([
  `Love`,
  `Amiable`,
  `Courteous`,
  `Neutral`,
  `Suspicious`,
  `Dislike`,
  `Hatred`
])

export const Stat = new Enum([
  `Strength`,
  `Dexterity`,
  `Constitution`,
  `Beauty`,
  `Intelligence`,
  `Perception`,
  `Willpower`,
  `Charisma`,
  `CarryWeight`,
  `DamageBonus`,
  `ArmorClassAdjustment`,
  `Speed`,
  `HealRate`,
  `PoisonRecoveryRate`,
  `ReactionModifier`,
  `MaxFollowers`,
  `MagicTechAptitude`,
  `Level`,
  `ExperiencePoints`,
  `Alignment`,
  `FatePoints`,
  `UnspentPoints`,
  `MagicPoints`,
  `TechPoints`,
  `PoisonLevel`,
  `Age`,
  `Gender`,
  `Race`
])

export const Monster = new Enum([
  `Wolf`,
  `Spider`,
  `Ord`,
  `EarthElemental`,
  `LesserDemon`,
  `LesserSkeleton`,
  `LesserZombie`,
  `LesserMummy`,
  `GreaterDemon`,
  `Bunny`,
  `MechSpider`,
  `Automaton`,
  `LizardMan`,
  `PhantomKnight`,
  `WereRat`,
  `SnakeMan`,
  `Ape`,
  `Bear`,
  `Chicken`,
  `Cougar`,
  `Sheep`,
  `Tiger`,
  `Pig`,
  `Cow`,
  `Wisp`,
  `MutantPig`,
  `FireElemental`,
  `WaterElemental`,
  `AirElemental`,
  `DeathKnight`,
  `SpiderQueen`,
  `Werewolf`
])

export const Scenery = new Enum([
  `Projectile`,
  `TreeLarge`,
  `TreeMedium`,
  `TreeSmall`,
  `TreeDead`,
  `Plant`,
  `MetalSmall`,
  `MetalMedium`,
  `MetalLarge`,
  `StoneSmall`,
  `StoneMedium`,
  `StoneLarge`,
  `WoodenSmall`,
  `WoodenMedium`,
  `WoodenLarge`,
  `MiscSmall`,
  `MiscMedium`,
  `MiscLarge`,
  `MachineLarge`,
  `MachineMedium`,
  `TeleportFacade`,
  `LightSource`,
  `Bed`
])

export const Written = new Enum([
  `Book`,
  `Note`,
  `Newspaper`,
  `Telegram`,
  `Image`,
  `Schematic`,
  `Plague`
])

export const Ammo = new Enum([`Arrows`, `Bullets`, `Charges`, `Fuel`])
