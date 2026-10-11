"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Pair_1 = require("./Pair");
const Encoder_1 = require("./Encoder");
const Decoder_1 = require("./Decoder");
/**
 * Constructs a new static PSON encoder and decoder pair.
 * @exports PSON.StaticPair
 * @class A static PSON encoder and decoder pair.
 * @param {Array.<string>=} dict Static dictionary
 * @param {Object.<string,*>=} options Options
 * @constructor
 */
class StaticPair extends Pair_1.Pair {
    constructor(dict, options) {
        super();
        this.encoder = new Encoder_1.Encoder(dict, false, options);
        this.decoder = new Decoder_1.Decoder(dict, false, options);
    }
}
exports.StaticPair = StaticPair;
//# sourceMappingURL=StaticPair.js.map