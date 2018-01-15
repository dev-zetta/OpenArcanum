
// A Set is a collection of unique elements.
export class Set {

    constructor(elements)
    {
        this.entries = [];

        if (Array.isArray(elements))
        {
            for (let i = 0; i < elements.length; i++)
            {
                this.set(elements[i]);
            }
        }
    }

    set(value) {
        if (!this.entries.includes(value))
        {
            this.entries.push(value);
        }

        return this;
    }

    get(property, value) {
        for (const entry of this.entries) {
            if (entry[property] === value)
            {
                return entry;
            }
        }
    }

    getArray() {
        return this.entries.slice(0);
    }

    delete(value) {
        const index = this.entries.indexOf(value);

        if (index > -1)
        {
            this.entries.splice(index, 1);
        }

        return this;
    }

    dump() {
        console.group('Set');

        for (const entry of this.entries) {
            console.log(entry);
        }

        console.groupEnd();
    }


    //  For when you know this Set will be modified during the iteration
    each(callback, callbackScope) {
        let i;
        const temp = this.entries.slice();
        const len = temp.length;

        if (callbackScope)
        {
            for (i = 0; i < len; i++)
            {
                if (callback.call(callbackScope, temp[i], i) === false)
                {
                    break;
                }
            }
        }
        else
        {
            for (i = 0; i < len; i++)
            {
                if (callback(temp[i], i) === false)
                {
                    break;
                }
            }
        }

        return this;
    }

    //  For when you absolutely know this Set won't be modified during the iteration
    iterate(callback, callbackScope) {
        let i;
        const len = this.entries.length;

        if (callbackScope)
        {
            for (i = 0; i < len; i++)
            {
                if (callback.call(callbackScope, this.entries[i], i) === false)
                {
                    break;
                }
            }
        }
        else
        {
            for (i = 0; i < len; i++)
            {
                if (callback(this.entries[i], i) === false)
                {
                    break;
                }
            }
        }

        return this;
    }

    iterateLocal(callbackKey) {
        let i;
        const args = [];

        for (i = 1; i < arguments.length; i++)
        {
            args.push(arguments[i]);
        }

        const len = this.entries.length;

        for (i = 0; i < len; i++)
        {
            const entry = this.entries[i];

            entry[callbackKey](...args);
        }

        return this;
    }

    clear() {
        this.entries.length = 0;

        return this;
    }

    contains(value) {
        return (this.entries.includes(value));
    }

    union(set) {
        const newSet = new Set();

        set.values.forEach(value => {
            newSet.add(value);
        });

        this.entries.forEach(value => {
            newSet.add(value);
        });

        return newSet;
    }

    intersect(set) {
        const newSet = new Set();

        this.entries.forEach(value => {
            if (set.contains(value))
            {
                newSet.add(value);
            }
        });

        return newSet;
    }

    difference(set) {
        const newSet = new Set();

        this.entries.forEach(value => {
            if (!set.contains(value))
            {
                newSet.add(value);
            }
        });

        return newSet;
    }


        get size() {
            return this.entries.length;
        }

        set size(value) {
            return this.entries.length = value;
        }



}
