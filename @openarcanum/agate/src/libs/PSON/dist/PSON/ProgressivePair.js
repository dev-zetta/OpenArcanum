"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Pair_1 = require("./Pair");
const Encoder_1 = require("./Encoder");
const Decoder_1 = require("./Decoder");
/**
 * Constructs a new progressive PSON encoder and decoder pair.
 * @exports PSON.ProgressivePair
 * @class A progressive PSON encoder and decoder pair.
 * @param {Array.<string>=} dict Initial dictionary
 * @param {Object.<string,*>=} options Options
 * @constructor
 */
class ProgressivePair extends Pair_1.Pair {
    constructor(dict, options) {
        super();
        this.encoder = new Encoder_1.Encoder(dict, true, options);
        this.decoder = new Decoder_1.Decoder(dict, true, options);
    }
}
exports.ProgressivePair = ProgressivePair;
//# sourceMappingURL=ProgressivePair.js.map