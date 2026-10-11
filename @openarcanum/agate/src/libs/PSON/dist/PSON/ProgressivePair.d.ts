import { Pair } from "./Pair";
/**
 * Constructs a new progressive PSON encoder and decoder pair.
 * @exports PSON.ProgressivePair
 * @class A progressive PSON encoder and decoder pair.
 * @param {Array.<string>=} dict Initial dictionary
 * @param {Object.<string,*>=} options Options
 * @constructor
 */
export declare class ProgressivePair extends Pair {
    constructor(dict: string[], options: {
        [key: string]: any;
    });
}
