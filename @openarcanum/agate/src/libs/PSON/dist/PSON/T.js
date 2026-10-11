"use strict";
/**
 * PSON byte types.
 * @exports PSON.T
 * @namespace
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZERO = 0x00; // 0
//             0x01; // -1
//             0x02; // 1
//             ...   // zig-zag encoded varints
exports.MAX = 0xEF; // -120, max. zig-zag encoded varint
exports.NULL = 0xF0; // null
exports.TRUE = 0xF1; // true
exports.FALSE = 0xF2; // false
exports.EOBJECT = 0xF3; // {}
exports.EARRAY = 0xF4; // []
exports.ESTRING = 0xF5; // ""
exports.OBJECT = 0xF6; // {...}
exports.ARRAY = 0xF7; // [...]
exports.INTEGER = 0xF8; // number (zig-zag encoded varint32)
exports.LONG = 0xF9; // Long   (zig-zag encoded varint64)
exports.FLOAT = 0xFA; // number (float32)
exports.DOUBLE = 0xFB; // number (float64)
exports.STRING = 0xFC; // string (varint length + data)
exports.STRING_ADD = 0xFD; // string (varint length + data, add to dictionary)
exports.STRING_GET = 0xFE; // string (varint index to get from dictionary)
exports.BINARY = 0xFF; // bytes (varint length + data)
//# sourceMappingURL=T.js.map