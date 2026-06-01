(() => {
    // Each content page declares which token it requires via <body data-requires="...">.
    const required = document.body.dataset.requires;
    let token = null;
    try { token = sessionStorage.getItem('mm_access'); } catch (_) { /* ignore */ }

    // wedding password unlocks every page; otherwise the token must match the page.
    const allowed = token === 'wedding' || token === required;

    if (!allowed) {
        window.location.replace('index.html');
    }
})();
