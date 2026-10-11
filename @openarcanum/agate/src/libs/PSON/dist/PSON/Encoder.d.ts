import * as ByteBuffer from "bytebuffer";
/**
 * Constructs a new PSON Encoder.
 * @exports PSON.Encoder
 * @class A PSON Encoder.
 * @param {Array.<string>=} dict Initial dictionary
 * @param {boolean} progressive Whether this is a progressive or a static encoder
 * @param {Object.<string,*>=} options Options
 * @constructor
 */
export declare class Encoder {
    private progressive;
    /**
     * Dictionary hash.
     */
    private dict;
    /**
     * Next dictionary index.
     * @type {number}
     */
    next: number;
    constructor(dict: string[] | undefined, progressive: boolean, options: {
        [opt: string]: any;
    });
    /**
     * Encodes JSON to PSON.
     * @param {*} json JSON
     * @param {(!ByteBuffer)=} buf Buffer to encode to. When omitted, the resulting ByteBuffer will be flipped. When
     *  specified, it will not be flipped.
     * @returns {!ByteBuffer} PSON
     */
    encode(json: any, buf?: ByteBuffer): ByteBuffer;
    /**
     * Encodes a single JSON value to PSON.
     * @param {*} val JSON value
     * @param {!ByteBuffer} buf Target buffer
     * @private
     */
    private encodeValue;
}
