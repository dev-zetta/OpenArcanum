"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Constructs a new abstract PSON encoder and decoder pair.
 * @exports PSON.Pair
 * @class An abstract PSON encoder and decoder pair.
 * @constructor
 * @abstract
 */
class Pair {
    /**
     * Encodes JSON to PSON.
     * @param {*} json JSON
     * @returns {!ByteBuffer} PSON
     * @expose
     */
    encode(json) {
        return this.encoder.encode(json);
    }
    /**
     * Encodes JSON straight to an ArrayBuffer of PSON.
     * @param {*} json JSON
     * @returns {!ArrayBuffer} PSON as ArrayBuffer
     * @expose
     */
    toArrayBuffer(json) {
        return this.encoder.encode(json).toArrayBuffer();
    }
    /**
     * Encodes JSON straight to a node Buffer of PSON.
     * @param {*} json JSON
     * @returns {!Buffer} PSON as node Buffer
     * @expose
     */
    toBuffer(json) {
        return this.encoder.encode(json).toBuffer();
    }
    /**
     * Decodes PSON to JSON.
     * @param {ByteBuffer|ArrayBuffer|Buffer} pson PSON
     * @returns {*} JSON
     * @expose
     */
    decode(pson) {
        return this.decoder.decode(pson);
    }
}
exports.Pair = Pair;
//# sourceMappingURL=Pair.js.map