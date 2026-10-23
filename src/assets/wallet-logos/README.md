# Wallet logos (optional)

Kwenta ships **monogram icons** for GCash, Maya, GoTyme and Maribank, not the
companies' logos. To show an official logo instead, add the file here, named
after the provider id:

| Provider            | File name                                      |
| ------------------- | ---------------------------------------------- |
| GCash               | `gcash.svg` (or `.png`)                        |
| Maya                | `maya.svg`                                     |
| GoTyme              | `gotyme.svg`                                   |
| Maribank            | `maribank.svg`                                 |
| Bank / Cash / Other | `bank.svg`, `cash.svg`, `other.svg` (optional) |

Rules of thumb:

- **Get them from the company.** Use each brand's official press / brand-asset
  page and read its usage terms (some require permission, clear space, or
  forbid recoloring). Don't screenshot or trace logos.
- **Transparent background**, SVG preferred (or PNG at least 128×128). Square
  icons and wide wordmarks both work: the tile follows the logo's proportions.
- They sit on a dark, see-through tile. Logos that are a single dark color
  (GoTyme, bank, cash, other) are automatically shown in light, because dark
  on dark is invisible; full-color logos are left exactly as supplied. To change
  which ones are lightened, edit `LIGHTEN` in `src/walletLogos.js`.
- Only add the ones you have the right to use. Anything missing keeps its
  monogram automatically.
- Files are bundled at build time. Run `npm run build` (or restart
  `npm run dev`) after adding one.
