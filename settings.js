// Settings Page Script

document.addEventListener('DOMContentLoaded', async function () {
    const backBtn = document.getElementById('backBtn');
    const lightThemeBtn = document.getElementById('lightThemeBtn');
    const darkThemeBtn = document.getElementById('darkThemeBtn');

    // Load saved theme
    const data = await chrome.storage.local.get(['theme']);
    const savedTheme = data.theme || 'light';
    applyTheme(savedTheme);

    // Back button - close settings and go back
    backBtn.addEventListener('click', () => {
        window.location.href = 'popup.html';
    });

    // Theme buttons
    lightThemeBtn.addEventListener('click', () => {
        setTheme('light');
    });

    darkThemeBtn.addEventListener('click', () => {
        setTheme('dark');
    });

    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            lightThemeBtn.classList.add('active');
            darkThemeBtn.classList.remove('active');
        } else {
            document.body.classList.remove('light-theme');
            darkThemeBtn.classList.add('active');
            lightThemeBtn.classList.remove('active');
        }
    }

    async function setTheme(theme) {
        applyTheme(theme);
        await chrome.storage.local.set({ theme: theme });

        // Notify popup about theme change
        chrome.runtime.sendMessage({ type: 'THEME_CHANGED', theme: theme });
    }
});
