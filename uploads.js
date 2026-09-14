(() => {
    const home = document.querySelector('[data-guest-home]');
    try {
        if (home && sessionStorage.getItem('mm_access') === 'wedding') home.href = 'wedding.html';
    } catch (_) { /* Keep the ceremony link if session storage is unavailable. */ }
    const form = document.getElementById('upload-form');
    if (!form) return;
    const picker = form.querySelector('[type="file"]');
    const button = form.querySelector('[type="submit"]');
    const status = document.getElementById('upload-status');
    const list = document.getElementById('upload-files');
    const fields = form.querySelector('fieldset');
    const maxBytes = 90 * 1024 * 1024;
    const extensions = /\.(jpe?g|png|gif|webp|heic|heif|avif|mp4|mov|m4v|webm|3gp)$/i;
    let items = [];
    let busy = false;
    let available = false;

    function updateButton() {
        button.disabled = !available || !items.some(item => item.state === 'ready' || item.state === 'failed');
    }
    picker.addEventListener('change', () => {
        list.replaceChildren();
        items = Array.from(picker.files).map(file => {
            const row = document.createElement('li');
            const label = document.createElement('span');
            label.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
            const message = document.createElement('span');
            const progress = document.createElement('progress');
            progress.max = 100;
            progress.value = 0;
            progress.hidden = true;
            progress.setAttribute('aria-label', `Upload progress for ${file.name}`);
            const invalid = !extensions.test(file.name) ? 'Unsupported file type' :
                file.size === 0 ? 'This file is empty' : file.size > maxBytes ? 'Too large — maximum 90 MB' : '';
            message.textContent = invalid || 'Ready to upload';
            row.append(label, message, progress);
            list.append(row);
            return { file, message, progress, state: invalid ? 'invalid' : 'ready' };
        });
        status.textContent = available ? 'Your files are ready to review. Tap Upload to send them.' : 'Uploads are currently unavailable. Please try again later.';
        updateButton();
    });

    function upload(item) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload');
            xhr.timeout = 20 * 60 * 1000;
            xhr.setRequestHeader('X-Upload-Code', form.elements.code.value.trim());
            xhr.setRequestHeader('X-Guest-Name', encodeURIComponent(form.elements.guest.value.trim()));
            xhr.setRequestHeader('X-File-Name', encodeURIComponent(item.file.name));
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.upload.onprogress = event => {
                if (event.lengthComputable) {
                    item.progress.value = Math.round(event.loaded / event.total * 100);
                    item.message.textContent = item.progress.value === 100 ? 'Saving…' : `Uploading… ${item.progress.value}%`;
                }
            };
            xhr.onload = () => {
                let body;
                try { body = JSON.parse(xhr.responseText); } catch { /* handled below */ }
                if (xhr.status >= 200 && xhr.status < 300 && body?.ok) resolve();
                else reject(new Error(body?.error || 'Upload failed. Please try again.'));
            };
            xhr.onerror = () => reject(new Error('Connection lost. Please try again.'));
            xhr.ontimeout = () => reject(new Error('Upload timed out. Try again on a stronger connection.'));
            xhr.onabort = () => reject(new Error('Upload cancelled. Please try again.'));
            xhr.send(item.file);
        });
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !available) return;
        busy = true;
        fields.disabled = true;
        button.disabled = true;
        status.textContent = 'Uploading — please keep this page open until your files have saved.';
        for (const item of items.filter(item => item.state === 'ready' || item.state === 'failed')) {
            item.progress.hidden = false;
            item.progress.value = 0;
            item.message.textContent = 'Uploading…';
            try {
                await upload(item);
                item.state = 'done';
                item.progress.value = 100;
                item.message.textContent = 'Saved — thank you!';
            } catch (error) {
                item.state = 'failed';
                item.message.textContent = error.message;
                item.progress.hidden = true;
            }
        }
        busy = false;
        fields.disabled = false;
        const done = items.filter(item => item.state === 'done').length;
        const failed = items.some(item => item.state === 'failed');
        status.textContent = `${done} file${done === 1 ? '' : 's'} saved. ` + (failed
            ? 'Some files couldn’t upload. Check the messages below and retry; saved files won’t be sent again.'
            : 'Thank you for sharing your memories! You can choose more files to send.');
        button.textContent = failed ? 'Retry failed uploads' : 'Upload photos & videos';
        updateButton();
    });
    window.addEventListener('beforeunload', event => {
        if (busy) { event.preventDefault(); event.returnValue = ''; }
    });
    fetch('/api/upload', { cache: 'no-store' })
        .then(response => { if (!response.ok) throw new Error(); return response.json(); })
        .then(config => {
            available = config.available === true;
            status.textContent = available ? 'Choose your photos and videos to get started.' :
                'Uploads aren’t open yet. Please keep your photos and try again later.';
            fields.disabled = !available;
            updateButton();
        })
        .catch(() => {
            status.textContent = 'We couldn’t connect to uploads. Please refresh the page to try again.';
        });
})();
