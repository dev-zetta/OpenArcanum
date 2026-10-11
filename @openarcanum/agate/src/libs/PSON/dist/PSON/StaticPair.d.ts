import { Pair } from "./Pair";
/**
 * Constructs a new static PSON encoder and decoder pair.
 * @exports PSON.StaticPair
 * @class A static PSON encoder and decoder pair.
 * @param {Array.<string>=} dict Static dictionary
 * @param {Object.<string,*>=} options Options
 * @constructor
 */
export declare class StaticPair extends Pair {
    constructor(dict: string[], options: {
        [key: string]: any;
    });
}
