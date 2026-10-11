"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ByteBuffer = require("bytebuffer");
const T_1 = require("./T");
/**
 * Constructs a new PSON Decoder.
 * @exports PSON.Decoder
 * @class A PSON Decoder.
 * @param {Array.<string>} dict Initial dictionary values
 * @param {boolean} progressive Whether this is a progressive or a static decoder
 * @param {Object.<string,*>=} options Options
 * @constructor
 */
class Decoder {
    constructor(dict = [], progressive, options = {}) {
        this.dict = dict;
        this.progressive = progressive;
        this.options = options;
    }
    /**
     * Decodes PSON to JSON.
     * @param {!(ByteBuffer|ArrayBuffer|Buffer)} buf PSON
     * @returns {?} JSON
     */
    decode(buf) {
        if (!(buf instanceof ByteBuffer)) {
            buf = ByteBuffer.wrap(buf);
        }
        const le = buf.littleEndian;
        try {
            const val = this.decodeValue(buf.LE());
            buf.littleEndian = le;
            return val;
        }
        catch (e) {
            buf.littleEndian = le;
            throw (e);
        }
    }
    /**
     * Decodes a single PSON value to JSON.
     * @param {!ByteBuffer} buf Buffer to decode from
     * @returns {?} JSON
     * @private
     */
    decodeValue(buf) {
        let t = buf.readUint8();
        if (t <= T_1.MAX) {
            return ByteBuffer.zigZagDecode32(t);
        }
        else {
            switch (t) {
                case T_1.NULL:
                    return null;
                case T_1.TRUE:
                    return true;
                case T_1.FALSE:
                    return false;
                case T_1.EOBJECT:
                    return {};
                case T_1.EARRAY:
                    return [];
                case T_1.ESTRING:
                    return "";
                case T_1.OBJECT:
                    t = buf.readVarint32(); // #keys
                    const obj = {};
                    while (--t >= 0) {
                        obj[this.decodeValue(buf)] = this.decodeValue(buf);
                    }
                    return obj;
                case T_1.ARRAY:
                    t = buf.readVarint32(); // #items
                    const arr = [];
                    while (--t >= 0) {
                        arr.push(this.decodeValue(buf));
                    }
                    return arr;
                case T_1.INTEGER:
                    return buf.readVarint32ZigZag(); // TODO: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/22580
                case T_1.LONG:
                    const r = buf.readVarint64ZigZag();
                    if (r.lessThanOrEqual(Number.MAX_SAFE_INTEGER) && r.greaterThanOrEqual(Number.MIN_SAFE_INTEGER)) {
                        return r.toNumber();
                    }
                    return r;
                case T_1.FLOAT:
                    return buf.readFloat32();
                case T_1.DOUBLE:
                    return buf.readFloat64();
                case T_1.STRING:
                    return buf.readVString();
                case T_1.STRING_ADD:
                    const str = buf.readVString();
                    this.dict.push(str);
                    return str;
                case T_1.STRING_GET:
                    return this.dict[buf.readVarint32()];
                case T_1.BINARY:
                    t = buf.readVarint32();
                    const ret = buf.slice(buf.offset, buf.offset + t);
                    buf.offset += t;
                    return ret;
                default:
                    throw (new Error(`Illegal type at ${buf.offset}: ${t}`));
            }
        }
    }
}
exports.Decoder = Decoder;
//# sourceMappingURL=Decoder.js.map