// Reference Tracker - Popup Script

document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const referenceList = document.getElementById('referenceList');
    const countBadge = document.getElementById('count');
    const statusEl = document.getElementById('status');
    const liveIndicator = document.getElementById('liveIndicator');
    const searchInput = document.getElementById('searchInput');
    const refreshBtn = document.getElementById('refreshBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const copyAllUrlsBtn = document.getElementById('copyAllUrlsBtn');
    const clearBtn = document.getElementById('clearBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const lastUpdateEl = document.getElementById('lastUpdate');

    let allReferences = [];
    let currentTabId = null;

    // Load saved theme
    loadTheme();

    // Initialize
    init();

    async function loadTheme() {
        const data = await chrome.storage.local.get(['theme']);
        if (data.theme === 'dark') {
            document.body.classList.remove('light-theme');
        }
    }

    // Listen for theme changes from settings
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'THEME_CHANGED') {
            if (message.theme === 'light') {
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
            }
        }
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });

    async function init() {
        console.log('[Popup] Initializing...');

        try {
            // Get current tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];

            if (!currentTab) {
                showStatus('No active tab found', true);
                return;
            }

            currentTabId = currentTab.id;
            console.log('[Popup] Current tab:', currentTab.url);

            // Check if we can inject into this tab
            if (currentTab.url.startsWith('chrome://') ||
                currentTab.url.startsWith('edge://') ||
                currentTab.url.startsWith('about:') ||
                currentTab.url.startsWith('chrome-extension://')) {
                showStatus('Cannot track on browser pages', true);
                showEmptyState('Cannot access browser internal pages');
                return;
            }

            // Try to ping the content script first
            try {
                await chrome.tabs.sendMessage(currentTabId, { type: 'PING' });
                console.log('[Popup] Content script is active');
            } catch (e) {
                console.log('[Popup] Content script not loaded, injecting...');
                // Inject the content script
                await chrome.scripting.executeScript({
                    target: { tabId: currentTabId },
                    files: ['content.js']
                });
                // Wait a bit for it to initialize
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // Now get references
            await getReferences();

        } catch (error) {
            console.error('[Popup] Init error:', error);
            showStatus('Error: ' + error.message, true);
            // Try to load from storage as fallback
            loadFromStorage();
        }

        // Listen for updates from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'REFERENCES_UPDATED' && sender.tab?.id === currentTabId) {
                console.log('[Popup] Received update:', message.references.length, 'references');
                displayReferences(message.references);

                if (message.newCount > 0) {
                    showToast(`${message.newCount} new reference${message.newCount > 1 ? 's' : ''} found!`);
                }
            }
        });
    }

    async function getReferences() {
        try {
            showStatus('Scanning page...');

            const response = await chrome.tabs.sendMessage(currentTabId, { type: 'GET_REFERENCES' });
            console.log('[Popup] Got response:', response);

            if (response && response.success) {
                displayReferences(response.references || []);
                showStatus(`Found ${response.references?.length || 0} references`);
            } else {
                loadFromStorage();
            }
        } catch (error) {
            console.error('[Popup] Error getting references:', error);
            loadFromStorage();
        }
    }

    async function loadFromStorage() {
        console.log('[Popup] Loading from storage...');
        const data = await chrome.storage.local.get(['references', 'lastUpdate', 'pageUrl']);

        if (data.references && data.references.length > 0) {
            displayReferences(data.references);
            showStatus(`Loaded ${data.references.length} cached references`);
            if (data.lastUpdate) {
                updateLastUpdate(data.lastUpdate);
            }
        } else {
            showEmptyState();
            showStatus('No references found');
        }
    }

    function displayReferences(references) {
        allReferences = references || [];

        // Update count
        countBadge.textContent = allReferences.length;

        // Update last update time
        updateLastUpdate(Date.now());
        liveIndicator.classList.remove('inactive');

        if (allReferences.length === 0) {
            showEmptyState();
            return;
        }

        // Apply search filter if any
        const searchTerm = searchInput.value.toLowerCase();
        const filteredRefs = searchTerm
            ? allReferences.filter(ref =>
                ref.text.toLowerCase().includes(searchTerm) ||
                (ref.doi && ref.doi.toLowerCase().includes(searchTerm))
            )
            : allReferences;

        // Clear and rebuild list
        referenceList.innerHTML = '';

        filteredRefs.forEach((ref, index) => {
            const item = createReferenceItem(ref, index + 1);
            referenceList.appendChild(item);
        });
    }

    function createReferenceItem(ref, displayIndex) {
        const item = document.createElement('div');
        item.className = 'reference-item';
        item.dataset.id = ref.id;

        // Number badge
        const numberBadge = document.createElement('span');
        numberBadge.className = 'reference-number';
        numberBadge.textContent = `#${displayIndex}`;
        item.appendChild(numberBadge);

        // Reference text
        const textEl = document.createElement('div');
        textEl.className = 'reference-text';
        textEl.textContent = ref.text;
        item.appendChild(textEl);

        // Link if available
        if (ref.link && ref.link.url) {
            const linkEl = document.createElement('a');
            linkEl.className = 'reference-link';
            linkEl.href = ref.link.url;
            linkEl.textContent = ref.link.url;
            linkEl.target = '_blank';
            linkEl.onclick = (e) => e.stopPropagation();
            item.appendChild(linkEl);
        }

        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'reference-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.textContent = '📋 Copy';
        copyBtn.onclick = (e) => {
            e.stopPropagation();
            copyToClipboard(ref.text);
            showToast('Reference copied!');
        };
        actions.appendChild(copyBtn);

        // Copy URL button - always show but handle missing URL
        const copyUrlBtn = document.createElement('button');
        copyUrlBtn.className = 'action-btn';
        if (ref.link && ref.link.url) {
            copyUrlBtn.textContent = '🔗 Copy URL';
            copyUrlBtn.onclick = (e) => {
                e.stopPropagation();
                copyToClipboard(ref.link.url);
                showToast('URL copied!');
            };
        } else {
            copyUrlBtn.textContent = '🔗 No URL';
            copyUrlBtn.style.opacity = '0.5';
            copyUrlBtn.style.cursor = 'not-allowed';
            copyUrlBtn.onclick = (e) => {
                e.stopPropagation();
                showToast('No URL available for this reference');
            };
        }
        actions.appendChild(copyUrlBtn);

        // Open URL button - only if URL exists
        if (ref.link && ref.link.url) {
            const openBtn = document.createElement('button');
            openBtn.className = 'action-btn';
            openBtn.textContent = '↗️ Open';
            openBtn.onclick = (e) => {
                e.stopPropagation();
                chrome.tabs.create({ url: ref.link.url });
            };
            actions.appendChild(openBtn);
        }

        item.appendChild(actions);

        // Click to expand
        let expanded = false;
        item.onclick = () => {
            expanded = !expanded;
            textEl.style.webkitLineClamp = expanded ? 'unset' : '3';
            textEl.style.display = expanded ? 'block' : '-webkit-box';
        };

        return item;
    }

    function showEmptyState(message) {
        referenceList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📖</span>
        <p>${message || 'No references found on this page'}</p>
        <p class="empty-hint">Navigate to a page with references to start tracking</p>
      </div>
    `;
        liveIndicator.classList.add('inactive');
    }

    function showStatus(message, isError = false) {
        statusEl.textContent = message;
        statusEl.style.color = isError ? 'var(--error)' : 'var(--text-secondary)';
    }

    function updateLastUpdate(timestamp) {
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lastUpdateEl.textContent = `Last updated: ${timeStr}`;
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Copy failed:', err);
        });
    }

    function showToast(message) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // Event Listeners
    searchInput.addEventListener('input', () => {
        displayReferences(allReferences);
    });

    refreshBtn.addEventListener('click', async () => {
        refreshBtn.textContent = '⏳';

        try {
            if (currentTabId) {
                // Re-inject content script to ensure it's fresh
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: currentTabId },
                        files: ['content.js']
                    });
                } catch (e) {
                    // Script might already be injected
                }

                await new Promise(resolve => setTimeout(resolve, 300));

                const response = await chrome.tabs.sendMessage(currentTabId, { type: 'FORCE_REFRESH' });
                if (response && response.references) {
                    displayReferences(response.references);
                    showToast('Refreshed!');
                    showStatus(`Found ${response.references.length} references`);
                }
            }
        } catch (error) {
            console.error('Refresh error:', error);
            showToast('Could not refresh');
        }

        refreshBtn.textContent = '🔄';
    });

    copyAllBtn.addEventListener('click', () => {
        if (allReferences.length === 0) {
            showToast('No references to copy');
            return;
        }

        const formattedRefs = allReferences.map((ref) => {
            // Only add URL if it's not already in the text
            const hasUrlInText = ref.link && ref.link.url && ref.text.includes(ref.link.url);
            if (hasUrlInText || !ref.link || !ref.link.url) {
                return ref.text;
            }
            return `${ref.text}\n${ref.link.url}`;
        }).join('\n\n');

        copyToClipboard(formattedRefs);
        showToast(`Copied ${allReferences.length} references!`);
    });

    // Copy All URLs button
    copyAllUrlsBtn.addEventListener('click', () => {
        if (allReferences.length === 0) {
            showToast('No references available');
            return;
        }

        // Filter references that have URLs
        const refsWithUrls = allReferences.filter(ref => ref.link && ref.link.url);

        if (refsWithUrls.length === 0) {
            showToast('No URLs found in references');
            return;
        }

        const urls = refsWithUrls.map(ref => ref.link.url).join('\n');
        copyToClipboard(urls);

        const message = refsWithUrls.length === allReferences.length
            ? `Copied ${refsWithUrls.length} URLs!`
            : `Copied ${refsWithUrls.length}/${allReferences.length} URLs (some references have no URL)`;
        showToast(message);
    });

    clearBtn.addEventListener('click', async () => {
        if (confirm('Clear all tracked references?')) {
            try {
                if (currentTabId) {
                    await chrome.tabs.sendMessage(currentTabId, { type: 'CLEAR_REFERENCES' });
                }
            } catch (e) {
                // Content script might not be available
            }

            await chrome.storage.local.remove(['references', 'lastUpdate']);
            allReferences = [];
            displayReferences([]);
            showToast('References cleared');
            showStatus('Cleared');
        }
    });
});
