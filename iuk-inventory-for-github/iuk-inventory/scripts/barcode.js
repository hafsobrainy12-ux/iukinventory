const bwipjs = require('bwip-js');

// Generates a CODE128 barcode as a PNG buffer, synchronously.
// bwip-js is pure JavaScript (no native compilation needed), so this
// installs cleanly on any computer with just `npm install` - no extra
// build tools required.
function generateBarcodePNG(value, opts = {}) {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text: value,
    scale: opts.scale || 3,
    height: opts.height ? Math.round(opts.height / 5) : 12,
    includetext: true,
    textxalign: 'center',
    textsize: 10,
    paddingwidth: 8,
    paddingheight: 8,
  });
}

module.exports = { generateBarcodePNG };
