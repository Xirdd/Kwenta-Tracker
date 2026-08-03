function scrimEl() {
  return document.getElementById("scrim");
}
function sheetEl() {
  return document.getElementById("sheet");
}

export function openModal(html, onScrimClick) {
  sheetEl().innerHTML = html;
  scrimEl().classList.add("show");
  sheetEl().classList.add("show");
  scrimEl().onclick = onScrimClick || closeModal;
}

export function closeModal() {
  scrimEl().classList.remove("show");
  sheetEl().classList.remove("show");
}
