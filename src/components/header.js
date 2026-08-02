export function renderHeader() {
  return `
  <header>
    <div class="brand">
      <h1>Kwenta</h1>
      <p>sulit sa bawat piso</p>
    </div>
    <div class="header-actions">
      <button class="icon-btn" id="exportBtn" title="Export CSV">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>
      </button>
      <div class="peso-mark">₱</div>
    </div>
  </header>`;
}
