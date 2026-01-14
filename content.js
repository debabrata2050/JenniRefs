// Reference Tracker - Content Script
// This script runs on every page and extracts references

(function () {
    'use strict';

    console.log('[Reference Tracker] Content script loaded on:', window.location.href);

    // Store found references
    let references = [];
    let observer = null;

    // Selectors for finding references - ordered by specificity
    const REFERENCE_SELECTORS = [
        // Primary selector from the user's example
        'ol[class*="citations"] li[data-cy="reference-cite"]',
        'ol[class*="references"] li[data-cy="reference-cite"]',
        // CSL entries directly
        '.csl-entry',
        'div[data-csl-entry-id]',
        // Common academic reference formats
        'ol.references li',
        'ol.citation-list li',
        'ul.references li',
        'div.references li',
        'section.references li',
        '#references li',
        '.reference-list li',
        '[class*="reference"] li',
        '[class*="citation"] li',
        // Fallback: any ordered list item that looks like a reference
        'ol li[data-cy*="cite"]',
        'ol li[data-cy*="reference"]'
    ];

    // Extract text content from a reference element
    function extractReferenceText(element) {
        // Try to find the CSL entry first
        const cslEntry = element.querySelector('.csl-entry') || element.querySelector('[data-csl-entry-id]');
        if (cslEntry) {
            return cleanText(cslEntry.textContent);
        }

        // Try to find text in span
        const textSpan = element.querySelector('span[class*="text"]');
        if (textSpan) {
            return cleanText(textSpan.textContent);
        }

        // If the element itself is a csl-entry
        if (element.classList.contains('csl-entry') || element.hasAttribute('data-csl-entry-id')) {
            return cleanText(element.textContent);
        }

        // Fallback to full text content
        return cleanText(element.textContent);
    }

    function cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '')
            .trim();
    }

    // Extract link from a reference element
    function extractReferenceLink(element) {
        const links = element.querySelectorAll('a[href]');
        for (const link of links) {
            // Prefer DOI links
            if (link.href.includes('doi.org')) {
                return {
                    url: link.href,
                    text: link.textContent.trim()
                };
            }
        }
        // Return first link if no DOI found in anchor tags
        if (links.length > 0) {
            return {
                url: links[0].href,
                text: links[0].textContent.trim()
            };
        }

        // No hyperlink found - try to find DOI in text and convert to link
        const text = element.textContent;

        // DOI patterns to search for in text
        // Standard DOI format: 10.XXXX/something
        const doiPatterns = [
            // Full URL format
            /https?:\/\/doi\.org\/(10\.[^\s]+)/i,
            /doi\.org\/(10\.[^\s]+)/i,
            // doi: or doi: with optional space - captures everything after
            /\bdoi[:\s]*(10\.[^\s]+)/i,
            // Just the DOI number pattern (10.xxxx/xxxx)
            /\b(10\.\d{4,}\/[^\s]+)/i
        ];

        for (const pattern of doiPatterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                let doi = match[1];
                // Clean up the DOI (remove trailing punctuation like . , ; ) ] etc.)
                doi = doi.replace(/[.,;:)\]'"]+$/, '');
                return {
                    url: `https://doi.org/${doi}`,
                    text: doi
                };
            }
        }

        return null;
    }

    // Extract DOI from a reference element
    function extractDOI(element) {
        // Check data attribute first
        const cslEntry = element.querySelector('[data-csl-entry-id]') ||
            (element.hasAttribute('data-csl-entry-id') ? element : null);
        if (cslEntry) {
            return cslEntry.getAttribute('data-csl-entry-id');
        }

        // Try to find DOI in links
        const links = element.querySelectorAll('a[href]');
        for (const link of links) {
            if (link.href.includes('doi.org')) {
                const match = link.href.match(/doi\.org\/(.+)/);
                if (match) return match[1];
            }
        }

        return null;
    }

    // Simple hash function for generating IDs
    function generateHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'ref_' + Math.abs(hash).toString(36);
    }

    // Find all references on the page
    function findReferences() {
        console.log('[Reference Tracker] Scanning for references...');
        const newReferences = [];
        const seenTexts = new Set();

        for (const selector of REFERENCE_SELECTORS) {
            try {
                const elements = document.querySelectorAll(selector);
                console.log(`[Reference Tracker] Selector "${selector}" found ${elements.length} elements`);

                elements.forEach((element) => {
                    const text = extractReferenceText(element);

                    // Filter out empty, too short, or duplicate entries
                    if (text && text.length > 20 && !seenTexts.has(text)) {
                        seenTexts.add(text);

                        const link = extractReferenceLink(element);
                        const doi = extractDOI(element);
                        const id = generateHash(text.substring(0, 100));

                        newReferences.push({
                            id: id,
                            index: newReferences.length + 1,
                            text: text,
                            link: link,
                            doi: doi,
                            timestamp: Date.now()
                        });
                    }
                });

                // If we found references with this selector, don't try others
                if (newReferences.length > 0) {
                    console.log(`[Reference Tracker] Found ${newReferences.length} references with selector: ${selector}`);
                    break;
                }

            } catch (e) {
                console.warn('[Reference Tracker] Error with selector', selector, e);
            }
        }

        console.log(`[Reference Tracker] Total references found: ${newReferences.length}`);
        return newReferences;
    }

    // Update references and store them
    function updateReferences() {
        const newRefs = findReferences();
        const hasChanges = newRefs.length !== references.length ||
            newRefs.some((r, i) => !references[i] || r.id !== references[i].id);

        if (hasChanges) {
            const addedCount = Math.max(0, newRefs.length - references.length);
            references = newRefs;

            // Store in chrome storage
            chrome.storage.local.set({
                references: references,
                lastUpdate: Date.now(),
                pageUrl: window.location.href,
                pageTitle: document.title
            }, () => {
                console.log('[Reference Tracker] Saved', references.length, 'references to storage');
            });

            // Try to send message to popup if it's open
            try {
                chrome.runtime.sendMessage({
                    type: 'REFERENCES_UPDATED',
                    references: references,
                    newCount: addedCount
                });
            } catch (e) {
                // Popup not open, that's fine
            }
        }

        return references;
    }

    // Set up MutationObserver to watch for changes
    function setupObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver((mutations) => {
            // Debounce updates
            clearTimeout(window.refTrackerTimeout);
            window.refTrackerTimeout = setTimeout(() => {
                updateReferences();
            }, 500);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('[Reference Tracker] DOM observer started');
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Reference Tracker] Received message:', message.type);

        if (message.type === 'GET_REFERENCES') {
            const refs = updateReferences();
            console.log('[Reference Tracker] Sending', refs.length, 'references to popup');
            sendResponse({
                references: refs,
                pageUrl: window.location.href,
                success: true
            });
            return true;
        }

        if (message.type === 'FORCE_REFRESH') {
            references = [];
            const refs = updateReferences();
            sendResponse({
                references: refs,
                success: true
            });
            return true;
        }

        if (message.type === 'CLEAR_REFERENCES') {
            references = [];
            chrome.storage.local.remove(['references', 'lastUpdate']);
            sendResponse({ success: true });
            return true;
        }

        if (message.type === 'PING') {
            sendResponse({ success: true, message: 'Content script is active' });
            return true;
        }
    });

    // Initialize
    function init() {
        console.log('[Reference Tracker] Initializing...');

        // Initial scan after a short delay
        setTimeout(() => {
            updateReferences();
            setupObserver();
        }, 500);

        // Periodic check (every 3 seconds)
        setInterval(updateReferences, 3000);
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
