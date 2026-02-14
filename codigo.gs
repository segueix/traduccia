/**
 * EpubCraft (Google Apps Script Web App)
 * Serveix la interfície client-side de l'editor EPUB.
 */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('EpubCraft · Editor EPUB')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
