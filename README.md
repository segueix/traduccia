# EpubCraft

Eina web (Google Apps Script + HTML) per editar fitxers EPUB directament al navegador.

## Funcionalitats

- Carregar un `.epub`.
- Afegir o substituir la portada del llibre.
- Detectar capítols sense `<h1>` i inserir un títol de capítol automàticament.
- Crear i editar l'índex (TOC) manualment.
- Regenerar `nav.xhtml` i `toc.ncx` (si el llibre ja utilitza NCX).
- Descarregar l'EPUB modificat.

## Fitxers principals

- `index.html`: interfície i tota la lògica client-side.
- `codigo.gs`: punt d'entrada `doGet()` per publicar com a web app.

## Ús ràpid

1. Publica el projecte com a **Web App** des de Google Apps Script.
2. Obre la URL de la web app.
3. Carrega l'EPUB.
4. Aplica canvis (portada, títols, índex).
5. Descarrega l'EPUB editat.
