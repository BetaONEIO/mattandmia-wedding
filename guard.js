(() => {
    // Each content page declares which token it requires via <body data-requires="...">.
    const required = document.body.dataset.requires;
    let token = null;
    try { token = sessionStorage.getItem('mm_access'); } catch (_) { /* ignore */ }

    // wedding password unlocks both pages; meal unlocks only the evening page.
    const allowed =
        token === 'wedding' ||
        (token === 'meal' && required === 'meal');

    if (!allowed) {
        window.location.replace('index.html');
    }
})();
