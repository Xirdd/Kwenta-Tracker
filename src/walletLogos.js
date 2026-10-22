import "./walletLogos.css";
import { categoryIconBadge } from "./categories.js";
import { iconPaths } from "./icons/categoryIcons.js";
import { escapeHtml } from "./format.js";

// Official wallet logos — optional, and none ship with the app.
//
// Drop a file named after the provider id into src/assets/wallet-logos/ and it
// replaces that provider's monogram everywhere a wallet icon is drawn:
//
//   gcash.svg   maya.svg   gotyme.svg   maribank.svg   (.png also works)
//
// They're picked up at BUILD time (import.meta.glob), so a provider with no
// file simply keeps its monogram — nothing 404s, nothing needs configuring.
// Only the logos of providers a person actually uses need to exist.
//
// Use each company's OFFICIAL brand/press assets and follow their usage rules;
// the app deliberately does not bundle or fetch anyone's trademarked artwork.
// See src/assets/wallet-logos/README.md.
const files = import.meta.glob("./assets/wallet-logos/*.{svg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});

const LOGO_BY_PROVIDER = {};
for (const [path, url] of Object.entries(files)) {
  const id = path
    .split("/")
    .pop()
    .replace(/\.(svg|png)$/i, "");
  LOGO_BY_PROVIDER[id] = url;
}

export function walletLogoUrl(providerId) {
  return LOGO_BY_PROVIDER[providerId] || null;
}

// The icon for a wallet provider (an entry of WALLET_PROVIDERS): the official
// logo on a white tile if one was added, otherwise the colored monogram badge.
// The url comes from the build (hashed asset path), never from user input.
export function walletBadge(provider, size = 32) {
  const url = walletLogoUrl(provider.id);
  if (!url) {
    return categoryIconBadge(
      { color: provider.color, icon: iconPaths(provider.icon) },
      size,
    );
  }
  return `<span class="cat-icon-badge wallet-logo-badge" style="width:${size}px;height:${size}px;"><img src="${escapeHtml(url)}" alt="" decoding="async"/></span>`;
}
