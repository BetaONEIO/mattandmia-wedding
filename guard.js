(() => {
    // The page declares the token it requires on the guard <script> tag itself:
    //   <script src="guard.js" data-requires="meal"></script>
    // We read it from document.currentScript (not document.body) so the guard can
    // run synchronously in <head> — before <body> is parsed — and redirect BEFORE
    // any protected content is painted. Reading document.body here would fail,
    // because in <head> the body does not exist yet.
    const script = document.currentScript;
    const required = script && script.dataset.requires;

    let token = null;
    try { token = sessionStorage.getItem('mm_access'); } catch (_) { /* ignore */ }

    // wedding password unlocks every page; otherwise the token must match the page.
    const allowed = token === 'wedding' || token === required;

    if (!allowed) {
        window.location.replace('index.html');
    }
})();
