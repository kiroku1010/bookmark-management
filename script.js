document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const hamburgerButton = document.getElementById('hamburger-menu-button');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const importBookmarksButton = document.getElementById('import-bookmarks-button');
    const bookmarkFileInput = document.getElementById('bookmark-file-input');
    const bookmarkList = document.getElementById('bookmark-list');
    const orderSelect = document.getElementById('order-select');
    const toggleGroupButton = document.getElementById('toggle-group-button');
    const deleteBrokenLinksButton = document.getElementById('delete-broken-links-button');
    const backButton = document.getElementById('back-button');

    // --- Global State Variables ---
    let allBookmarksHierarchy = [];
    let allBookmarksFlat = [];
    let originalBookmarksHierarchy = [];
    let currentFolderStack = [];
    let isGroupedBySite = false;

    // --- Constants ---
    const DEFAULT_THUMBNAIL_URL = 'https://via.placeholder.com/180x96/ADD8E6/333333?text=Site+Preview';
    const FOLDER_ICON_CLOSED = '📁';
    const FOLDER_ICON_OPEN = '📂';
    const SITE_GROUP_ICON = '🌐';
    const STORAGE_KEY = 'bookmarkManagerData';

    // --- Data Persistence ---
    function saveBookmarksToLocal() {
        if (allBookmarksHierarchy.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allBookmarksHierarchy));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    function loadBookmarksFromLocal() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                if (Array.isArray(parsedData)) {
                    allBookmarksHierarchy = parsedData;
                    originalBookmarksHierarchy = JSON.parse(JSON.stringify(allBookmarksHierarchy));
                    allBookmarksFlat = flattenHierarchy(allBookmarksHierarchy);
                    currentFolderStack = [{ name: "Root", children: allBookmarksHierarchy }];
                    displayCurrentFolderContent(); // Display the loaded content
                    return true;
                }
            } catch (e) {
                console.error("Failed to parse bookmarks from local storage:", e);
                localStorage.removeItem(STORAGE_KEY); // Clear corrupted data
            }
        }
        return false;
    }
    
    function clearSavedBookmarks() {
        if(confirm('保存されているすべてのブックマークを消去しますか？この操作は元に戻せません。')) {
            allBookmarksHierarchy = [];
            allBookmarksFlat = [];
            originalBookmarksHierarchy = [];
            currentFolderStack = [];
            isGroupedBySite = false;
            saveBookmarksToLocal(); // This will remove the item from local storage
            displayCurrentFolderContent();
            alert('保存されたブックマークを消去しました。');
            hamburgerMenu.classList.remove('open');
        }
    }

    // --- Main Setup ---
    function handleImport(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                parseBookmarks(e.target.result);
            };
            reader.readAsText(file);
        }
    }

    function parseBookmarks(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const rootDl = doc.querySelector('body > dl');

        if (!rootDl) {
            bookmarkList.innerHTML = '<p>有効なブックマークHTMLファイルが見つかりませんでした。</p>';
            return;
        }

        allBookmarksHierarchy = parseHtmlToHierarchy(rootDl);
        originalBookmarksHierarchy = JSON.parse(JSON.stringify(allBookmarksHierarchy));
        allBookmarksFlat = flattenHierarchy(allBookmarksHierarchy);
        
        saveBookmarksToLocal(); // Save after successful import
        
        currentFolderStack = [{ name: "Root", children: allBookmarksHierarchy }];
        displayCurrentFolderContent(); 
        hamburgerMenu.classList.remove('open');
    }

    function parseHtmlToHierarchy(rootNode) {
        const items = [];
        Array.from(rootNode.children).forEach(node => {
            if (node.tagName === 'DT') {
                const h3 = node.querySelector('H3');
                const a = node.querySelector('A');
                
                if (h3) { // This DT contains an H3, indicating a folder
                    const folderName = h3.textContent.trim();
                    const folder = { type: 'folder', name: folderName, children: [] };
                    
                    let nextDl = node.querySelector('DL');
                    if (!nextDl) {
                        let nextSibling = node.nextElementSibling;
                        if (nextSibling && nextSibling.tagName === 'DD') {
                            nextDl = nextSibling.querySelector('DL') || nextSibling.nextElementSibling;
                        } else if (nextSibling && nextSibling.tagName === 'DL') {
                            nextDl = nextSibling;
                        }
                    }
                    if (nextDl && nextDl.tagName === 'DL') {
                        folder.children = parseHtmlToHierarchy(nextDl);
                    }
                    items.push(folder);

                } else if (a && a.href) {
                    items.push({ type: 'bookmark', url: a.href, title: a.textContent.trim() || a.href });
                }
            } else if (node.tagName === 'DD') {
                const a = node.querySelector('A');
                if (a && a.href) {
                    items.push({ type: 'bookmark', url: a.href, title: a.textContent.trim() || a.href });
                }
            }
        });
        return items;
    }

    function flattenHierarchy(hierarchy) {
        const flatList = [];
        hierarchy.forEach(item => {
            if (item.type === 'bookmark') {
                flatList.push(item);
            } else if (item.type === 'folder' && item.children) {
                flatList.push(...flattenHierarchy(item.children));
            }
        });
        return flatList;
    }

    function createBookmarkItemElement(bookmark) {
        const bookmarkItem = document.createElement('a');
        bookmarkItem.href = bookmark.url;
        bookmarkItem.target = "_blank";
        bookmarkItem.rel = "noopener noreferrer";
        bookmarkItem.classList.add('bookmark-item');
        bookmarkItem.title = bookmark.title;

        const img = document.createElement('img');
        img.classList.add('bookmark-thumbnail');
        img.src = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(bookmark.url)}?w=180&h=96`;
        img.alt = `Preview of ${bookmark.title}`;
        img.onerror = () => { img.src = DEFAULT_THUMBNAIL_URL; };

        const title = document.createElement('h3');
        title.textContent = bookmark.title;

        bookmarkItem.appendChild(img);
        bookmarkItem.appendChild(title);
        return bookmarkItem;
    }

    function createFolderElement(folder) {
        const folderElement = document.createElement('div');
        folderElement.classList.add('bookmark-folder');
        folderElement.title = folder.name;
        
        const icon = document.createElement('div');
        icon.classList.add('folder-icon');
        icon.textContent = isGroupedBySite ? SITE_GROUP_ICON : FOLDER_ICON_CLOSED;

        const title = document.createElement('h3');
        title.textContent = folder.name;
        
        folderElement.appendChild(icon);
        folderElement.appendChild(title);
        folderElement.addEventListener('click', () => navigateToFolder(folder));
        return folderElement;
    }

    function displayCurrentFolderContent() {
        if (currentFolderStack.length === 0) {
            bookmarkList.innerHTML = '<p>「ブックマークをインポート」ボタンからブックマーク(HTMLファイル)をインポートしてください。</p>';
            backButton.disabled = true;
            orderSelect.disabled = true;
            return;
        }

        orderSelect.disabled = isGroupedBySite;
        let itemsToDisplay;
        const sortOrder = orderSelect.value;
        const currentFolder = currentFolderStack[currentFolderStack.length - 1];

        if (isGroupedBySite) {
            const grouped = {};
            allBookmarksFlat.forEach(bookmark => {
                try {
                    const hostname = new URL(bookmark.url).hostname;
                    if (!grouped[hostname]) {
                        grouped[hostname] = { type: 'folder', name: hostname, children: [] };
                    }
                    grouped[hostname].children.push(bookmark);
                } catch (e) {
                    if (!grouped['(無効なURL)']) {
                        grouped['(無効なURL)'] = { type: 'folder', name: '(無効なURL)', children: [] };
                    }
                    grouped['(無効なURL)'].children.push(bookmark);
                }
            });
            
            if (currentFolderStack.length > 1 && currentFolder.name !== 'Root') {
                itemsToDisplay = grouped[currentFolder.name]?.children || [];
            } else {
                itemsToDisplay = Object.values(grouped).sort((a,b) => a.name.localeCompare(b.name));
            }
            backButton.disabled = currentFolderStack.length <= 1;
        } else {
            itemsToDisplay = [...currentFolder.children];
            backButton.disabled = currentFolderStack.length <= 1;
        }

        bookmarkList.innerHTML = ''; 

        if (!isGroupedBySite) {
            if (sortOrder === 'asc') {
                itemsToDisplay.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));
            } else if (sortOrder === 'desc') {
                itemsToDisplay.sort((a, b) => (b.title || b.name).localeCompare(a.title || a.name));
            } else if (sortOrder === 'random') {
                itemsToDisplay.sort(() => Math.random() - 0.5);
            }
        }
        
        if (itemsToDisplay.length === 0) {
            bookmarkList.innerHTML = '<p>このフォルダにはアイテムがありません。</p>';
            return;
        }

        const container = document.createElement('div');
        container.classList.add('item-container');
        itemsToDisplay.forEach(item => {
            const element = item.type === 'bookmark' ? createBookmarkItemElement(item) : createFolderElement(item);
            container.appendChild(element);
        });
        bookmarkList.appendChild(container);
    }

    function navigateToFolder(folder) {
        if (folder.type === 'folder' && folder.children) {
            currentFolderStack.push(folder);
            displayCurrentFolderContent();
        }
    }

    function handleGoBack() {
        if (currentFolderStack.length > 1) {
            currentFolderStack.pop();
            displayCurrentFolderContent();
        }
    }

    function handleToggleGroup() {
        isGroupedBySite = !isGroupedBySite;
        toggleGroupButton.textContent = isGroupedBySite ? '元のフォルダ構成に戻す' : 'サイトが同じなら、同じフォルダにする';
        currentFolderStack = [{ name: "Root", children: allBookmarksHierarchy }];
        displayCurrentFolderContent();
        hamburgerMenu.classList.remove('open');
    }

    async function checkLink(url) {
        try {
            await fetch(url, { method: 'HEAD', mode: 'no-cors' });
            return true;
        } catch (error) {
            console.warn(`Link check failed for ${url}:`, error);
            return false;
        }
    }

    async function handleDeleteBrokenLinks() {
        if (allBookmarksFlat.length === 0) {
            alert('チェックするブックマークがありません。');
            return;
        }
        alert('リンク切れのチェックを開始します... (時間がかかる場合があります)');
        
        const validBookmarks = [];
        const brokenLinks = [];
        for (const bookmark of allBookmarksFlat) {
            if (await checkLink(bookmark.url)) {
                validBookmarks.push(bookmark);
            } else {
                brokenLinks.push(bookmark);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        allBookmarksHierarchy = [{ type: 'folder', name: '有効なブックマーク', children: validBookmarks }];
        allBookmarksFlat = validBookmarks;
        originalBookmarksHierarchy = JSON.parse(JSON.stringify(allBookmarksHierarchy));
        
        saveBookmarksToLocal(); // Save after deleting links

        currentFolderStack = [{ name: "Root", children: allBookmarksHierarchy }];
        displayCurrentFolderContent();
        hamburgerMenu.classList.remove('open');

        alert(`${brokenLinks.length}個のリンク切れのブックマークを削除しました。`);
    }

    // --- Event Listeners ---
    hamburgerButton.addEventListener('click', () => hamburgerMenu.classList.toggle('open'));
    document.addEventListener('click', (event) => {
        if (!hamburgerMenu.contains(event.target) && !hamburgerButton.contains(event.target) && hamburgerMenu.classList.contains('open')) {
            hamburgerMenu.classList.remove('open');
        }
    });
    importBookmarksButton.addEventListener('click', () => bookmarkFileInput.click());
    bookmarkFileInput.addEventListener('change', handleImport);
    toggleGroupButton.addEventListener('click', handleToggleGroup);
    deleteBrokenLinksButton.addEventListener('click', handleDeleteBrokenLinks);
    orderSelect.addEventListener('change', displayCurrentFolderContent);
    backButton.addEventListener('click', handleGoBack);

    // --- Initial Display ---
    if (!loadBookmarksFromLocal()) {
        // If nothing was loaded, show the initial empty message
        displayCurrentFolderContent();
    }
    
    // Add a button to clear local storage to the hamburger menu
    const clearButton = document.createElement('button');
    clearButton.textContent = '保存したブックマークを消去';
    clearButton.id = 'clear-saved-bookmarks-button';
    clearButton.addEventListener('click', clearSavedBookmarks);
    hamburgerMenu.appendChild(clearButton);
});
