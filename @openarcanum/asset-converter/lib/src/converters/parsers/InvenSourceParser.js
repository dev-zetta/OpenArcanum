const readline = require('readline');
const fs = require('fs');

var parseInvenSource = line => {
    let re = /^\{([^\}]+)\}\{([^\:]+)\:([^\}]+)\}/
  let val = line.match(re);
    let item = {
    id: val[1],
        'name': val[2],
    sells: []
    }

  re = /\s?([\-\d]+)\,(\d+)\s|$/gi;
  let match = [];
  while ((match = re.exec(val[3]))) {
    if (match[0] == '') {
            break;
        }
        item.sells.push({
            'chance': match[1],
            'prototype_id': match[2]
        })
    }
    return item
};

var parseInvenSourceBuy = line => {
    let re = /^\{([^\}]+)\}([^\:]+)\:\s*(0\,0)*\{([^\}]*)\}/
    let val = line.match(re);
  if (val === null) {
    debugger;
  }
    let item = {
    id: val[1],
    name: val[2],
    buys: []
    }
    // If(parseInt(val[1])>80) {
    //     debugger
  // }
    if(val[4] !== "") {
        val[4].split(' ').forEach(element => {
      item.buys.push({
        prototype_id: element
      });
    });
  }
    return item
};

const is = readline.createInterface({
    input: fs.createReadStream('InvenSource.mes'),
  crlfDelay: Infinity
});

var shops = {};
is
  .on('line', line => {
    if (line.startsWith('{')) {
      let item = parseInvenSource(line);
      shops[item.id] = item;
    }
}).on('close', () => {
    const isb = readline.createInterface({
      input: fs.createReadStream('InvenSourceBuy.mes'),
      crlfDelay: Infinity
    });
    
      .on('line', line => {
        if (line.startsWith('{')) {
            let item = parseInvenSourceBuy(line)
          if (shops.hasOwnProperty(item.id)) {
            shops[item.id].buys = item.buys;
          } else {
                console.log(line, item)
          }
        }
    }).on('close', () => {
        
        console.log(shops);
      });
});

