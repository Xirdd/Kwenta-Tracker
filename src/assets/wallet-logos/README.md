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
- **Square, transparent background**, SVG preferred (or PNG at least 128×128).
  They're shown on a white rounded tile, so a full-color logo works on any theme.
- Only add the ones you have the right to use. Anything missing keeps its
  monogram automatically.
- Files are bundled at build time. Run `npm run build` (or restart
  `npm run dev`) after adding one.
