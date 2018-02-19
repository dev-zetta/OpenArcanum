import uid from './uid';
import { fastSplice } from './utils';

const Symbol = window.requireNode('core-js/es6/symbol');
const _cachedApplicationRef = Symbol('_cachedApplicationRef');
const _componentList = Symbol('_componentList');
const _mixinRef = Symbol('_mixinRef');

/**
 * An entity.
 *
 * @class
 * @alias ECS.Entity
 */
export default class Entity {
    /**
     *
     * @param {number|UIDGenerator} idOrGenerator - The entity id if
     *  a Number is passed. If an UIDGenerator is passed, the entity will use
     *  it to generate a new id. If nothing is passed, the entity will use
     *  the default UIDGenerator.
     */
    constructor(idOrGenerator = uid.DefaultUIDGenerator) {
        /**
         * Unique identifier of the entity.
         *
         * @member {number}
         */
        this.id = typeof idOrGenerator === 'number' ? idOrGenerator : idOrGenerator.next();

        /**
         * Systems applied to the entity.
         *
         * @number {System[]}
         */
        this.systems = [];

        /**
         * A reference to parent ECS class.
         *
         * @member {ECS}
         */
        this.ecs = null;
    }

    /**
     * Checks if an entity has all the components passed.
     *
     * @example
     *
     * ```js
     * entity.hasComponents(Component1, Component2, ...);
     * ```
     *
     * @alias hasComponent
     * @param {...Component} components - The component classes to compose into a parent class.
     * @return {Component} A base-class component to extend from.
     */
    hasComponents(...components) {
        // Check that each passed component exists in the component list.
        // If it doesn't, then immediately return false.
        for (let i = 0; i < components.length; ++i) {
            const comp = components[i];
            let o = Object.getPrototypeOf(this);
            let found = false;

            while (o) {
                if (Object.prototype.hasOwnProperty.call(o, _mixinRef) && o[_mixinRef] === comp) {
                    found = true;
                    break;
                }
                o = Object.getPrototypeOf(o);
            }

            // if we traveled the chain and never found the component we
            // were looking for, then its done.
            if (!found) {
                return false;
            }
        }

        return true;
    }

    /**
     * Dispose the entity.
     *
     * @private
     */
    dispose() {
        while (this.systems.length) {
            this.systems[this.systems.length - 1].removeEntity(this);
        }
    }

    /**
     * Add a system to the entity.
     *
     * @private
     * @param {System} system - The system to add.
     */
    _addSystem(system) {
        this.systems.push(system);
    }

    /**
     * Remove a system from the entity.
     *
     * @private
     * @param {System} system - The system reference to remove.
     */
    _removeSystem(system) {
        const index = this.systems.indexOf(system);

        if (index !== -1) {
            fastSplice(this.systems, index, 1);
        }
    }
}

Entity.prototype.hasComponent = Entity.prototype.hasComponents;

/**
 * Composes an entity with the given components.
 *
 * @example
 *
 * ```js
 * class MyEntity extends ECS.Entity.with(Component1, Component2, ...) {
 * }
 * ```
 *
 * @static
 * @param {...Component} components - The component classes to compose into a parent class.
 * @return {Component} A base-class component to extend from.
 */
Entity.with = function entityWith(...components) {
    const Clazz = components.reduce((base, comp) => {
        // Get or create a symbol used to look up a previous application of mixin
        // to the class. This symbol is unique per mixin definition, so a class will have N
        // applicationRefs if it has had N mixins applied to it. A mixin will have
        // exactly one _cachedApplicationRef used to store its applications.
        let ref = comp[_cachedApplicationRef];

        if (!ref) {
            ref = comp[_cachedApplicationRef] = Symbol(comp.name);
        }

        // look up cached version of mixin/superclass
        if (Object.prototype.hasOwnProperty.call(base, ref)) {
            return base[ref];
        }

        // apply the component
        const app = comp(base);

        // cache it so we don't make it again
        base[ref] = app;

        // store the mixin we applied here.
        app.prototype[_mixinRef] = comp;

        return app;
    }, this);

    Clazz.prototype[_componentList] = components;

    return Clazz;
};

// export some symbols
Entity._cachedApplicationRef = _cachedApplicationRef;
Entity._componentList = _componentList;
