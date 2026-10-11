# Third-party notices

Project-authored code is GPL-3.0-or-later. The following components retain their
upstream licenses and copyright notices. A root GPL declaration does not replace
those notices or grant rights to original Arcanum assets.

| Component | Included location | License / notice |
| --- | --- | --- |
| dat.gui | `vendor/dat.gui/` | Apache-2.0; [license](vendor/dat.gui/LICENSE). |
| Ember Shopify draggable shim | `vendor/ember-cli-shopify-draggable-shim/` | MIT; [license](vendor/ember-cli-shopify-draggable-shim/LICENSE.md). |
| Pixi filters | `@openarcanum/agate/vendor/pixi-filters/` | MIT; [license](%40openarcanum/agate/vendor/pixi-filters/LICENSE), including the bundled package's notice. |
| PSON | `@openarcanum/agate/src/libs/PSON/` | Apache-2.0; [license](%40openarcanum/agate/src/libs/PSON/LICENSE). Source credits Daniel Wirtz and Andrew Sun. |
| Isometric projection code | `@openarcanum/agate/src/client/isometric/Isometric.js` | Lewis Lane's MIT notice is retained in the source. |
| Lance-derived engine/network/serialization code | AGate client, server, synchronization, world and serialization modules | Apache-2.0; [upstream license](licenses/Lance-Apache-2.0.txt), [upstream project](https://github.com/lance-gg/lance). These modules have been modified and reorganized for OpenArcanum. |

Other installed dependencies are obtained through package manifests and retain
their own licenses. Recovered dat.gui, draggable-shim and Pixi-filter vendor
copies remain with their source/notices for provenance; the current active
libraries are resolved through npm and the root lockfile. Dependency directories
and third-party Git histories are not imported as first-party project history.

The original converter's GPLv3-or-later copyright notice is retained at
[`@openarcanum/asset-converter/LICENSE`](%40openarcanum/asset-converter/LICENSE).
Its former MIT package metadata was corrected to match that notice.

The old asset database used a CC BY-NC-SA notice. Its images, fonts, movies,
archives, extracted text and converted game tables are omitted from this
publication. The authored UI scripts retained in its place are released under
the maintainer-authorized GPLv3-or-later terms. The old database notice remains
visible only as historical repository metadata.

The externally sourced experimental shader collection and unused vendored
Box2D/LiquidFun prototypes are omitted. Neither physics package has an active
import in the current engine; their obsolete local dependency entries were
removed. The four small generic shader sources used by the current renderer are
retained.
