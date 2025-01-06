class BookmarksEditor {
    constructor() {
        this.bookmarksData = new Map(); // 存储所有书签数据
        this.groupsData = new Map();    // 存储所有分组数据
        this.selectedBookmark = null;
        
        this.initializeElements();
        this.initializeEventListeners();
        this.loadBookmarksFromSource();
        this.bookmarkEditor = document.querySelector('.bookmark-editor');
        this.groupsList = document.querySelector('.groups-list');
        this.addGroupBtn = document.getElementById('addGroupBtn');
        this.initializeGroupEvents();
    }

    initializeElements() {
        this.groupsPanel = document.querySelector('.groups-panel');
        this.bookmarksList = document.querySelector('.bookmarks-list');
        this.methodSelect = document.getElementById('methodSelect');
        this.targetSelect = document.getElementById('targetSelect');
        this.valueInput = document.getElementById('valueInput');
        this.exportBtn = document.getElementById('exportBtn');
    }

    initializeEventListeners() {
        this.methodSelect.addEventListener('change', () => this.updateBookmarkRule());
        this.targetSelect.addEventListener('change', () => this.updateValueForTarget());
        this.valueInput.addEventListener('input', () => this.updateBookmarkRule());
        this.exportBtn.addEventListener('click', () => this.exportRules());
    }

    async loadBookmarksFromSource() {
        const urlParams = new URLSearchParams(window.location.search);
        const source = urlParams.get('source');
        const content = urlParams.get('content');

        try {
            if (source === 'file' && content) {
                // 从上传的文件加载
                const parser = new DOMParser();
                const doc = parser.parseFromString(decodeURIComponent(content), 'text/html');
                await this.processBookmarksFromHtml(doc);
            } else {
                // 从 Chrome 书签加载
                const bookmarks = await chrome.bookmarks.getTree();
                await this.processBookmarksFromChrome(bookmarks[0].children);
            }
        } catch (error) {
            console.error('Failed to load bookmarks:', error);
        }
    }

    async processBookmarksFromChrome(bookmarks, folderName = 'Bookmarks Bar') {
        if (!this.groupsData.has(folderName)) {
            this.groupsData.set(folderName, []);
        }
        
        for (const bookmark of bookmarks) {
            if (bookmark.url) {
                const bookmarkData = {
                    id: bookmark.id,
                    url: bookmark.url,
                    title: bookmark.title,
                    groupName: folderName,
                    selected: true,
                    method: 'includes',
                    target: 'hostname',
                    value: this.extractHostname(bookmark.url)
                };
                
                this.bookmarksData.set(bookmark.id, bookmarkData);
                this.groupsData.get(folderName).push(bookmark.id);
            }
            
            if (bookmark.children) {
                await this.processBookmarksFromChrome(bookmark.children, bookmark.title);
            }
        }
        
        this.renderGroups();
        this.renderBookmarks(this.groupsData.get('Bookmarks Bar'));
    }

    processBookmarksFromHtml(doc) {
        const folderStack = ['Bookmarks Bar'];
        
        const traverse = (node) => {
            if (node.tagName === 'H3') {
                folderStack.push(node.textContent);
                this.groupsData.set(node.textContent, []);
            }

            if (node.tagName === 'A') {
                const currentFolder = folderStack[folderStack.length - 1];
                const bookmarkData = {
                    id: Math.random().toString(36).substr(2, 9),
                    url: node.href,
                    title: node.textContent,
                    groupName: currentFolder,
                    selected: true,
                    method: 'includes',
                    target: 'hostname',
                    value: this.extractHostname(node.href)
                };
                
                this.bookmarksData.set(bookmarkData.id, bookmarkData);
                if (!this.groupsData.has(currentFolder)) {
                    this.groupsData.set(currentFolder, []);
                }
                this.groupsData.get(currentFolder).push(bookmarkData.id);
            }

            for (const child of node.children) {
                traverse(child);
            }

            if (node.tagName === 'DL' && folderStack.length > 1) {
                folderStack.pop();
            }
        };

        traverse(doc.body);
        this.renderGroups();
        this.renderBookmarks(this.groupsData.get('Bookmarks Bar'));
    }

    extractHostname(rawURL) {
        try {
            const url = new URL(rawURL);
            let hostname = url.hostname;
            if (hostname.startsWith('www.')) {
                hostname = hostname.slice(4);
            }
            return hostname;
        } catch {
            return '';
        }
    }

    renderGroups() {
        this.groupsList.innerHTML = '';
        for (const [groupName] of this.groupsData) {
            // 跳过 Other Bookmarks
            if (groupName === 'Other Bookmarks') continue;
            
            const groupElement = document.createElement('div');
            groupElement.className = 'group-item';
            
            const nameElement = document.createElement('div');
            nameElement.className = 'group-name';
            nameElement.textContent = groupName;
            nameElement.contentEditable = true;
            
            const actionsElement = document.createElement('div');
            actionsElement.className = 'group-actions';
            
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = 'Delete folder';
            
            actionsElement.appendChild(deleteBtn);
            groupElement.appendChild(nameElement);
            groupElement.appendChild(actionsElement);
            
            // 编辑文件夹名称
            nameElement.addEventListener('blur', () => {
                const newName = nameElement.textContent.trim();
                if (newName && newName !== groupName && !this.groupsData.has(newName)) {
                    const bookmarkIds = this.groupsData.get(groupName);
                    this.groupsData.delete(groupName);
                    this.groupsData.set(newName, bookmarkIds);
                    
                    // 更新所有相关书签的分组名称
                    for (const id of bookmarkIds) {
                        const bookmark = this.bookmarksData.get(id);
                        if (bookmark) {
                            bookmark.groupName = newName;
                        }
                    }
                    
                    this.renderGroups();
                } else {
                    nameElement.textContent = groupName;
                }
            });
            
            nameElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    nameElement.blur();
                }
            });
            
            // 删除文件夹
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete folder "${groupName}"?`)) {
                    this.groupsData.delete(groupName);
                    this.renderGroups();
                    // 如果当前显示的是被删除的文件夹，切换到 Bookmarks Bar
                    if (this.currentGroup === groupName) {
                        this.renderBookmarks(this.groupsData.get('Bookmarks Bar'));
                    }
                }
            });
            
            // 点击文件夹显示书签
            groupElement.addEventListener('click', () => {
                this.currentGroup = groupName;
                this.renderBookmarks(this.groupsData.get(groupName));
                this.groupsList.querySelectorAll('.group-item').forEach(el => 
                    el.classList.remove('active'));
                groupElement.classList.add('active');
            });
            
            this.groupsList.appendChild(groupElement);
        }
    }

    renderBookmarks(bookmarkIds) {
        this.bookmarksList.innerHTML = '';
        for (const id of bookmarkIds) {
            const bookmark = this.bookmarksData.get(id);
            const bookmarkElement = this.createBookmarkElement(bookmark);
            this.bookmarksList.appendChild(bookmarkElement);
        }
        // 切换文件夹时隐藏规则编辑器
        this.hideEditor();
    }

    createBookmarkElement(bookmark) {
        const element = document.createElement('div');
        element.className = 'bookmark-item';
        element.draggable = true;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = bookmark.selected;
        
        const favicon = document.createElement('img');
        favicon.className = 'favicon';
        const hostname = this.extractHostname(bookmark.url);
        favicon.src = `https://www.google.com/s2/favicons?domain=${hostname}`;
        favicon.onerror = () => {
            favicon.src = '../icons/icon16.png';
        };
        
        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = bookmark.title;
        title.title = 'Click to edit rules'; // 添加提示文本
        
        element.appendChild(checkbox);
        element.appendChild(favicon);
        element.appendChild(title);
        
        this.setupDragAndDrop(element, bookmark);
        
        checkbox.addEventListener('change', (e) => {
            bookmark.selected = e.target.checked;
            e.stopPropagation();
        });
        
        element.addEventListener('click', () => {
            this.bookmarksList.querySelectorAll('.bookmark-item').forEach(el => 
                el.classList.remove('active'));
            element.classList.add('active');
            
            this.selectedBookmark = bookmark;
            this.updateEditorForm(bookmark);
            this.showEditor();
        });
        
        return element;
    }

    setupDragAndDrop(element, bookmark) {
        element.addEventListener('dragstart', (e) => {
            element.classList.add('dragging');
            e.dataTransfer.setData('text/plain', bookmark.id);
        });
        
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
        });
        
        // 添加放置目标的事件处理
        this.groupsList.querySelectorAll('.group-item').forEach(groupElement => {
            groupElement.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
            
            groupElement.addEventListener('drop', (e) => {
                e.preventDefault();
                const bookmarkId = e.dataTransfer.getData('text/plain');
                const bookmark = this.bookmarksData.get(bookmarkId);
                if (bookmark) {
                    const oldGroup = bookmark.groupName;
                    const newGroup = groupElement.querySelector('.group-name').textContent;
                    
                    if (oldGroup !== newGroup) {
                        // 从旧分组中移除
                        const oldGroupBookmarks = this.groupsData.get(oldGroup);
                        const index = oldGroupBookmarks.indexOf(bookmarkId);
                        if (index > -1) {
                            oldGroupBookmarks.splice(index, 1);
                        }
                        
                        // 添加到新分组
                        if (!this.groupsData.has(newGroup)) {
                            this.groupsData.set(newGroup, []);
                        }
                        this.groupsData.get(newGroup).push(bookmarkId);
                        
                        // 更新书签的分组信息
                        bookmark.groupName = newGroup;
                        
                        // 重新渲染两个分组的书签
                        if (this.currentGroup === oldGroup) {
                            this.renderBookmarks(this.groupsData.get(oldGroup));
                        } else if (this.currentGroup === newGroup) {
                            this.renderBookmarks(this.groupsData.get(newGroup));
                        }
                    }
                }
            });
        });
    }

    updateEditorForm(bookmark) {
        this.methodSelect.value = bookmark.method;
        this.targetSelect.value = bookmark.target;
        this.valueInput.value = bookmark.value;
    }

    updateBookmarkRule() {
        if (!this.selectedBookmark) return;
        
        this.selectedBookmark.method = this.methodSelect.value;
        this.selectedBookmark.target = this.targetSelect.value;
        this.selectedBookmark.value = this.valueInput.value;
    }

    updateValueForTarget() {
        if (!this.selectedBookmark) return;
        
        const target = this.targetSelect.value;
        switch (target) {
            case 'hostname':
                this.valueInput.value = this.extractHostname(this.selectedBookmark.url);
                this.methodSelect.value = 'includes';
                break;
            case 'href':
                this.valueInput.value = this.selectedBookmark.url;
                this.methodSelect.value = 'equal';
                break;
            case 'page-title':
            case 'page-title-ignore-case':
                this.valueInput.value = this.selectedBookmark.title;
                this.methodSelect.value = 'includes';
                break;
        }
        
        this.updateBookmarkRule();
    }

    exportRules() {
        const rulesById = new Map();
        
        for (const [groupName, bookmarkIds] of this.groupsData) {
            const selectedBookmarks = bookmarkIds
                .map(id => this.bookmarksData.get(id))
                .filter(bookmark => bookmark.selected);
            
            if (selectedBookmarks.length === 0) continue;
            
            const ruleId = 'rule-' + Math.random().toString(36).substr(2, 8);
            const rule = {
                id: ruleId,
                enabled: true,
                ruleName: groupName,
                groupName: groupName,
                urlMatches: [],
                titleMatches: []
            };
            
            for (const bookmark of selectedBookmarks) {
                const match = {
                    method: bookmark.method,
                    value: bookmark.value
                };
                
                if (bookmark.target === 'page-title-ignore-case') {
                    match.ignoreCase = true;
                    rule.titleMatches.push(match);
                } else if (bookmark.target === 'page-title') {
                    rule.titleMatches.push(match);
                } else {
                    match.target = bookmark.target;
                    rule.urlMatches.push(match);
                }
            }
            
            rulesById.set(ruleId, rule);
        }
        
        const exportData = {
            meta: {
                name: "tab-groups-rules",
                version: 1
            },
            ...Object.fromEntries(rulesById)
        };
        
        // 下载导出的规则
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tab-groups-rules.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    showEditor() {
        this.bookmarkEditor.classList.add('visible');
    }

    hideEditor() {
        this.bookmarkEditor.classList.remove('visible');
        this.selectedBookmark = null;
        this.bookmarksList.querySelectorAll('.bookmark-item').forEach(el => 
            el.classList.remove('active'));
    }

    initializeGroupEvents() {
        this.addGroupBtn.addEventListener('click', () => this.createNewGroup());
    }

    createNewGroup() {
        const newGroupName = this.generateUniqueGroupName('New Folder');
        this.groupsData.set(newGroupName, []);
        this.renderGroups();
        // 找到新创建的组并开始编辑
        const groupElement = Array.from(this.groupsList.children)
            .find(el => el.querySelector('.group-name').textContent === newGroupName);
        if (groupElement) {
            const nameElement = groupElement.querySelector('.group-name');
            nameElement.contentEditable = true;
            nameElement.focus();
        }
    }

    generateUniqueGroupName(baseName) {
        let name = baseName;
        let counter = 1;
        while (this.groupsData.has(name)) {
            name = `${baseName} ${counter}`;
            counter++;
        }
        return name;
    }
}

// 初始化编辑器
new BookmarksEditor(); 