(() => {
  // ../shared-ui/test.ts
  var GREETINGZ = "Hello from Shared UI!";

  // src/content.ts
  function isHistoryTab() {
    const url = new URL(window.location.href);
    return url.searchParams.get("activeTab") === "history";
  }
  function replaceTable() {
    if (!isHistoryTab())
      return;
    const table = document.querySelector('div[role="table"]');
    if (!table || document.getElementById("bdbh-replacement"))
      return;
    table.style.display = "none";
    const toolbar = document.querySelector("#rc-tabs-0-panel-history > div.databricks-dataexplorer-1lakyo5");
    if (toolbar) {
      toolbar.style.display = "none";
    }
    const replacement = document.createElement("div");
    replacement.id = "bdbh-replacement";
    replacement.style.padding = "20px";
    replacement.style.fontSize = "18px";
    replacement.textContent = GREETINGZ;
    table.parentNode?.insertBefore(replacement, table);
    console.log("[Better DB History] Table replaced");
  }
  var observer = new MutationObserver(() => {
    if (isHistoryTab()) {
      replaceTable();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  if (isHistoryTab()) {
    replaceTable();
  }
  console.log("[Better DB History] Extension loaded");
})();
