import * as ByteBuffer from "bytebuffer";
/**
 * Constructs a new PSON Decoder.
 * @exports PSON.Decoder
 * @class A PSON Decoder.
 * @param {Array.<string>} dict Initial dictionary values
 * @param {boolean} progressive Whether this is a progressive or a static decoder
 * @param {Object.<string,*>=} options Options
 * @constructor
 */
export declare class Decoder {
    private dict;
    private progressive;
    private options;
    constructor(dict: string[], progressive: boolean, options?: {
        [opt: string]: any;
    });
    /**
     * Decodes PSON to JSON.
     * @param {!(ByteBuffer|ArrayBuffer|Buffer)} buf PSON
     * @returns {?} JSON
     */
    decode(buf: ByteBuffer | ArrayBuffer | Buffer): any;
    /**
     * Decodes a single PSON value to JSON.
     * @param {!ByteBuffer} buf Buffer to decode from
     * @returns {?} JSON
     * @private
     */
    private decodeValue;
}
