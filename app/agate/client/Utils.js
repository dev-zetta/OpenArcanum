import AGate from '../agate';
import Phaser from '../libs/phaser';

class CUtils {
  stringToColor(value) {
    if (value.startsWith('rgba') || value.startsWith('rgb')) {
      let values = value.substring(value.indexOf('(') + 1, value.indexOf(')') - 1);
      values = values.split(',');

      let r = AGate.Utils.parseInt(values[0]);
      let g = AGate.Utils.parseInt(values[1]);
      let b = AGate.Utils.parseInt(values[2]);
      let a = values.length > 3 ? AGate.Utils.parseInt(values[3]) : 255;

      //console.log(r, g, b, a);

      return Phaser.Display.Color.GetColor32(r, g, b, a);

      /*var result = (/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d+(?:\.\d+)?))?\s*\)$/).exec(rgb.toLowerCase());

      if (result)
      {
        var r = parseInt(result[1], 10);
        var g = parseInt(result[2], 10);
        var b = parseInt(result[3], 10);
        var a = (result[4] !== undefined) ? parseFloat(result[4]) : 1;

        color.setTo(r, g, b, a * 255);
      }*/


    }

  }
}

var Utils = new CUtils;
export {Utils};
