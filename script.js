'use strict';

// DOM Elements
const backBtn = document.getElementById('back-btn');
const sortOrder = document.getElementById('sort-order');
const randomSortBtn = document.getElementById('random-sort-btn');
const menuBtn = document.getElementById('menu-btn');
const bookmarksContainer = document.getElementById('bookmarks-container');
const sidebar = document.getElementById('sidebar');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');
const groupBySiteBtn = document.getElementById('group-by-site-btn');
const resetStructureBtn = document.getElementById('reset-structure-btn');
const deleteDeadLinksBtn = document.getElementById('delete-dead-links-btn');
const deleteDuplicatesBtn = document.getElementById('delete-duplicates-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn'); // New element

// App State
let allBookmarks = [];
let currentPath = []; // An array of indices to navigate the bookmark tree
let originalStructure = []; // To store the structure before grouping by site

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadBookmarksFromLocalStorage();
});

// --- Event Listeners ---
backBtn.addEventListener('click', () => {
    if (currentPath.length > 0) {
        currentPath.pop();
        renderItems(getFolderContents());
    }
});

sortOrder.addEventListener('change', (e) => {
    const items = getFolderContents();
    const sortedItems = [...items]; // Create a shallow copy to sort
    const order = e.target.value;

    if (order === 'asc') {
        sortedItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    } else if (order === 'desc') {
        sortedItems.sort((a, b) => b.name.localeCompare(a.name, 'ja'));
    } else {
        // 'default' returns to the original order
        renderItems(items);
        return;
    }
    renderItems(sortedItems);
});

randomSortBtn.addEventListener('click', () => {
    const items = getFolderContents();
    const shuffledItems = [...items];

    // Fisher-Yates (aka Knuth) Shuffle
    for (let i = shuffledItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledItems[i], shuffledItems[j]] = [shuffledItems[j], shuffledItems[i]];
    }
    renderItems(shuffledItems);
});

menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    document.body.classList.toggle('sidebar-open'); // Add/remove class from body
});

closeSidebarBtn.addEventListener('click', () => { // New event listener
    sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
});

importBtn.addEventListener('click', () => {
    importFile.click();
});

importFile.addEventListener('change', handleFileImport);

groupBySiteBtn.addEventListener('click', () => {
    // Save current structure to revert later
    originalStructure = JSON.parse(JSON.stringify(allBookmarks));
    
    const flattened = flattenBookmarks(allBookmarks);
    allBookmarks = groupBookmarksBySite(flattened);
    
    currentPath = []; // Reset path to root
    saveBookmarksToLocalStorage();
    renderItems(getFolderContents());
    
    groupBySiteBtn.style.display = 'none';
    resetStructureBtn.style.display = 'inline-block';
});

resetStructureBtn.addEventListener('click', () => {
    if (originalStructure) {
        allBookmarks = JSON.parse(JSON.stringify(originalStructure)); // Restore original structure
        currentPath = []; // Reset path to root
        saveBookmarksToLocalStorage();
        renderItems(getFolderContents());

        resetStructureBtn.style.display = 'none';
        groupBySiteBtn.style.display = 'inline-block';
    } else {
        alert('元のフォルダ構成が保存されていません。');
    }
});

deleteDeadLinksBtn.addEventListener('click', () => {
    // TODO: Implement dead link deletion (UI only for now)
    alert('この機能はまだ実装されていません。');
});

deleteDuplicatesBtn.addEventListener('click', () => {
    // Save current structure to revert later
    originalStructure = JSON.parse(JSON.stringify(allBookmarks));

    const initialCount = flattenBookmarks(allBookmarks).length;
    allBookmarks = removeDuplicates(allBookmarks);
    const finalCount = flattenBookmarks(allBookmarks).length;

    if (initialCount > finalCount) {
        alert(`${initialCount - finalCount}個の重複するブックマークを削除しました。`);
        currentPath = []; // Reset path to root
        saveBookmarksToLocalStorage();
        renderItems(getFolderContents());
        // Show reset button if duplicates were removed
        groupBySiteBtn.style.display = 'inline-block';
        resetStructureBtn.style.display = 'none'; // Re-evaluating display of this button
    } else {
        alert('重複するブックマークは見つかりませんでした。');
    }
});

// --- Core Functions ---

/**
 * Parses the imported HTML file content using line-by-line regex.
 * @param {string} htmlContent
 * @returns {Array} A tree structure of bookmarks and folders.
 */
function parseBookmarks(htmlContent) {
    const root = [];
    const stack = [{ type: 'folder', name: 'Root', children: root }]; // Simulate root folder

    const lines = htmlContent.split(/\r?\n/);
    
    // Regex patterns for different elements
    // Capture groups:
    // dtH3Regex: [1] ADD_DATE, [2] LAST_MODIFIED, [3] Folder Name
    const dtH3Regex = /<DT><H3(?:\s+ADD_DATE="(\d+)")?(?:\s+LAST_MODIFIED="(\d+)")?>(.*?)<\/H3>/i;
    // dtARegex: [1] HREF, [2] ADD_DATE, [3] ICON, [4] Bookmark Name
    const dtARegex = /<DT><A\s+HREF="(.*?)"(?:\s+ADD_DATE="(\d+)")?(?:\s+ICON="(.*?)")?.*?>(.*?)<\/A>/i;
    const dlEndRegex = /<\/DL>/i;

    for (const line of lines) {
        const trimmedLine = line.trim();
        let match;

        const currentParent = stack[stack.length - 1];

        if ((match = trimmedLine.match(dtH3Regex))) {
            // Folder: <DT><H3 ...>
            const folderName = match[3].trim();
            const newFolder = {
                type: 'folder',
                name: folderName,
                add_date: match[1],
                last_modified: match[2],
                children: []
            };
            currentParent.children.push(newFolder);
            stack.push(newFolder);
        } else if ((match = trimmedLine.match(dtARegex))) {
            // Bookmark: <DT><A ...>
            const bookmarkUrl = match[1];
            const bookmarkName = match[4].trim();
            const bookmarkAddDate = match[2];
            const bookmarkIcon = match[3];

            currentParent.children.push({
                type: 'bookmark',
                name: bookmarkName,
                url: bookmarkUrl,
                add_date: bookmarkAddDate,
                icon: bookmarkIcon
            });
        } else if (trimmedLine.match(dlEndRegex)) {
            // End of a <DL> block. Pop from stack if not the dummy root.
            if (stack.length > 1) {
                stack.pop();
            }
        }
        // <DL><p> is usually just a marker for new nesting.
        // Stack management is primarily done by H3 and /DL.
    }
    return root;
}

/**
 * Handles the file import event.
 * @param {Event} event
 */
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        try {
            allBookmarks = parseBookmarks(content);
            currentPath = [];
            saveBookmarksToLocalStorage();
            renderItems(getFolderContents());
            // Close sidebar after successful import
            sidebar.classList.remove('open');
        } catch (error) {
            console.error('ブックマークの解析に失敗しました:', error);
            alert('ブックマークファイルの解析に失敗しました。');
        }
    };
    reader.readAsText(file, 'UTF-8');
    // Reset file input to allow re-importing the same file
    event.target.value = '';
}


/**
 * Renders a given array of bookmarks and folders.
 * @param {Array} itemsToRender The items to display.
 */
function renderItems(itemsToRender) {
    bookmarksContainer.innerHTML = '';

    if (!itemsToRender) {
        console.error("itemsToRender is null or undefined.");
        return;
    }

    itemsToRender.forEach((item) => {
        // We need the original index for folder navigation, which is lost after sorting.
        // Let's find the original index from the master list.
        const originalIndex = getFolderContents().findIndex(originalItem => originalItem === item);

        if (item.type === 'folder') {
            const folderEl = document.createElement('div');
            folderEl.className = 'folder-item';
            folderEl.dataset.index = originalIndex;

            folderEl.innerHTML = `
                <div class="item-thumbnail">📁</div>
                <div class="item-title" title="${item.name}">${item.name}</div>
            `;
            
            folderEl.addEventListener('click', () => {
                const indexToPush = parseInt(folderEl.dataset.index, 10);
                if (!isNaN(indexToPush) && indexToPush > -1) {
                    currentPath.push(indexToPush);
                    renderItems(getFolderContents());
                     // Reset sort dropdown to 'default' when changing folder
                    sortOrder.value = 'default';
                }
            });
            bookmarksContainer.appendChild(folderEl);

        } else if (item.type === 'bookmark') {
            const bookmarkEl = document.createElement('a');
            bookmarkEl.className = 'bookmark-item';
            bookmarkEl.href = item.url;
            bookmarkEl.target = '_blank';
            bookmarkEl.rel = 'noopener noreferrer';

            const siteName = item.name || (item.url ? new URL(item.url).hostname : 'No Name');
            
            let thumbnailContent = '🔗'; // Default fallback icon
            if (item.url) {
                try {
                    // Using WordPress.com mShots service for website screenshots
                    // This is an unofficial, undocumented service and may change/break.
                    const mshotsUrl = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(item.url)}?w=200`;
                    thumbnailContent = `<img src="${mshotsUrl}" alt="Thumbnail for ${siteName}" onerror="this.onerror=null;this.outerHTML='🔗';" loading="lazy">`;
                } catch (e) {
                    console.warn(`Could not generate mshots URL for ${item.url}:`, e);
                }
            }

            bookmarkEl.innerHTML = `
                <div class="item-thumbnail">${thumbnailContent}</div>
                <div class="item-title" title="${siteName}">${item.name || item.url}</div>
            `;
            bookmarksContainer.appendChild(bookmarkEl);
        }
    });
    
    backBtn.style.visibility = currentPath.length > 0 ? 'visible' : 'hidden';
}

/**
 * Retrieves the content of the folder specified by the currentPath.
 * @returns {Array | null} The array of items in the current folder.
 */
function getFolderContents() {
    if (currentPath.length === 0) {
        return allBookmarks;
    }
    
    let currentLevel = allBookmarks;
    for (const index of currentPath) {
        const folder = currentLevel[index];
        if (folder && folder.type === 'folder' && Array.isArray(folder.children)) {
            currentLevel = folder.children;
        } else {
            // Path is invalid, reset and go to root
            console.error('Invalid path:', currentPath);
            currentPath = [];
            return allBookmarks;
        }
    }
    return currentLevel;
}



// --- Local Storage Functions ---

/**
 * Saves the current bookmarks tree to local storage.
 */
function saveBookmarksToLocalStorage() {
    try {
        localStorage.setItem('bookmarksData', JSON.stringify(allBookmarks));
    } catch (error) {
        console.error('ローカルストレージへの保存に失敗しました:', error);
        alert('ブックマークの保存に失敗しました。ストレージの空き容量が不足している可能性があります。');
    }
}

/**
 * Loads bookmarks from local storage and renders them.
 */
function loadBookmarksFromLocalStorage() {
    const savedData = localStorage.getItem('bookmarksData');
    if (savedData) {
        try {
            allBookmarks = JSON.parse(savedData);
            renderItems(getFolderContents());
        } catch (error) {
            console.error('ローカルストレージからの読み込みに失敗しました:', error);
            localStorage.removeItem('bookmarksData'); // Clear corrupted data
        }
    }
}

// --- Helper Functions for Grouping ---

/**
 * Recursively flattens the bookmark tree into a single array of bookmarks.
 * @param {Array} items - The current level of bookmarks/folders.
 * @returns {Array} - A flat array of bookmark objects.
 */
function flattenBookmarks(items) {
    let bookmarks = [];
    items.forEach(item => {
        if (item.type === 'bookmark') {
            bookmarks.push(item);
        } else if (item.type === 'folder' && item.children) {
            bookmarks = bookmarks.concat(flattenBookmarks(item.children));
        }
    });
    return bookmarks;
}

/**
 * Groups a flat list of bookmarks by their hostname and organizes them into a new folder structure.
 * Bookmarks with a unique hostname go into an "その他フォルダ" (Other folder).
 * @param {Array} flattenedBookmarks - A flat array of bookmark objects.
 * @returns {Array} - A new bookmark tree structure with grouped folders.
 */
function groupBookmarksBySite(flattenedBookmarks) {
    const grouped = {};
    flattenedBookmarks.forEach(bookmark => {
        try {
            const hostname = new URL(bookmark.url).hostname;
            if (!grouped[hostname]) {
                grouped[hostname] = [];
            }
            grouped[hostname].push(bookmark);
        } catch (e) {
            // Handle invalid URLs by putting them in an "無効なURL" folder
            const invalidFolder = "無効なURL";
            if (!grouped[invalidFolder]) {
                grouped[invalidFolder] = [];
            }
            grouped[invalidFolder].push(bookmark);
        }
    });

    const newStructure = [];
    let otherFolder = {
        type: 'folder',
        name: 'その他フォルダ',
        children: []
    };

    Object.entries(grouped).forEach(([hostname, bookmarks]) => {
        if (bookmarks.length === 1 && hostname !== "無効なURL") { // Single bookmark not already invalid
            otherFolder.children.push(bookmarks[0]);
        } else {
            newStructure.push({
                type: 'folder',
                name: hostname,
                children: bookmarks
            });
        }
    });

    // Add "その他フォルダ" only if it has content
    if (otherFolder.children.length > 0) {
        newStructure.push(otherFolder);
    }
    return newStructure;
}

/**
 * Recursively removes duplicate bookmarks from the tree.
 * @param {Array} items - The current level of bookmarks/folders.
 * @param {Set<string>} seenUrls - A Set to keep track of URLs already encountered.
 * @returns {Array} - A new array with duplicate bookmarks removed.
 */
function removeDuplicates(items, seenUrls = new Set()) {
    const newItems = [];
    items.forEach(item => {
        if (item.type === 'bookmark') {
            if (!seenUrls.has(item.url)) {
                newItems.push(item);
                seenUrls.add(item.url);
            }
        } else if (item.type === 'folder' && item.children) {
            const newChildren = removeDuplicates(item.children, seenUrls);
            // Only add folder if it still contains items after duplicate removal
            if (newChildren.length > 0) {
                newItems.push({ ...item, children: newChildren });
            }
        }
    });
    return newItems;
}
