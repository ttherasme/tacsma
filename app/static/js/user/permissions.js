document.addEventListener('DOMContentLoaded', function() {
    const pageSelect = document.getElementById('page-select');
    const elementSelect = document.getElementById('element-select');
    const addRuleForm = document.getElementById('add-rule-form');
    const rulesBody = document.getElementById('permission-rules-body');
    const saveAllButton = document.getElementById('save-all-rules');

    const filterLevelSelect = document.getElementById('filter-level');
    const filterPageSelect = document.getElementById('filter-page');

    const undoButton = document.getElementById('undo-rules');
    const redoButton = document.getElementById('redo-rules');

    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const pageNumbers = document.getElementById('page-numbers');

    const elementsMapData = document.getElementById('elements-map-data').textContent;
    const levelsData = document.getElementById('levels-data').textContent;
    const actionsData = document.getElementById('actions-data').textContent;

    const ELEMENTS_MAP = JSON.parse(elementsMapData);
    const LEVELS = JSON.parse(levelsData);
    const ACTIONS = JSON.parse(actionsData);

    const STORAGE_KEY = 'permission_rules_unsaved_state_v1';
    const PAGINATION_PER_PAGE = 10;

    let newRules = [];
    let deletedRules = [];
    let updatedRules = {};
    let tempIdCounter = 0;

    let allRows = Array.from(rulesBody.querySelectorAll('tr'));
    let filteredRows = [...allRows];
    let currentPage = 1;

    let undoStack = [];
    let redoStack = [];

    // ------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------
    function capitalize(value) {
        if (!value) return '';
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function getLevelLabel(levelId) {
        return `Level ${levelId} - ${LEVELS[levelId] || 'Unknown'}`;
    }

    function markCellModified(cell, modified = true) {
        if (!cell) return;
        cell.classList.toggle('modified-cell', modified);
    }

    function markRowModified(row, modified = true) {
        if (!row) return;
        row.classList.toggle('modified-row', modified);
    }

    function syncTempCounter() {
        const tempNumbers = newRules
            .map(r => String(r.temp_id || ''))
            .filter(id => id.startsWith('temp-'))
            .map(id => parseInt(id.replace('temp-', ''), 10))
            .filter(n => !Number.isNaN(n));

        tempIdCounter = tempNumbers.length ? Math.max(...tempNumbers) : 0;
    }

    function updateUndoRedoButtons() {
        if (undoButton) undoButton.disabled = undoStack.length === 0;
        if (redoButton) redoButton.disabled = redoStack.length === 0;
    }

    function createHistorySnapshot() {
        return {
            newRules: JSON.parse(JSON.stringify(newRules)),
            deletedRules: JSON.parse(JSON.stringify(deletedRules)),
            updatedRules: JSON.parse(JSON.stringify(updatedRules)),
            tempIdCounter,
            filterLevel: filterLevelSelect ? filterLevelSelect.value : '',
            filterPage: filterPageSelect ? filterPageSelect.value : '',
            currentPage
        };
    }

    function pushHistory() {
        undoStack.push(createHistorySnapshot());
        if (undoStack.length > 100) {
            undoStack.shift();
        }
        redoStack = [];
        updateUndoRedoButtons();
    }

    function persistState() {
        const payload = {
            newRules,
            deletedRules,
            updatedRules,
            tempIdCounter,
            filterLevel: filterLevelSelect ? filterLevelSelect.value : '',
            filterPage: filterPageSelect ? filterPageSelect.value : '',
            currentPage
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    function clearPersistedState() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function buildExistingRulesFromDOM() {
        return Array.from(rulesBody.querySelectorAll('tr'))
            .map(row => ({
                id: parseInt(row.getAttribute('data-id'), 10),
                level: parseInt(row.getAttribute('data-level'), 10),
                page: row.getAttribute('data-page'),
                element: row.children[2]?.textContent.trim() || '',
                action: (row.children[3]?.textContent.trim() || '').toLowerCase()
            }))
            .filter(r => !Number.isNaN(r.id));
    }

    const BASE_EXISTING_RULES = buildExistingRulesFromDOM();

    function buildRuleRow({
        id,
        level,
        page,
        element,
        action,
        status = 'existing',
        statusText = 'Saved'
    }) {
        const row = document.createElement('tr');
        row.setAttribute('data-id', id);
        row.setAttribute('data-status', status);
        row.setAttribute('data-level', String(level));
        row.setAttribute('data-page', page);

        row.innerHTML = `
            <td class="editable-level">${getLevelLabel(level)}</td>
            <td>${capitalize(page)}</td>
            <td>${element}</td>
            <td class="editable-action">${capitalize(action)}</td>
            <td>${statusText}</td>
            <td>
                <button class="update-rule-button" type="button">Update</button>
                <button class="delete-rule-button" type="button">Delete</button>
            </td>
        `;

        return row;
    }

    function applyStateToRowVisuals(row) {
        const ruleId = row.getAttribute('data-id');
        const status = row.getAttribute('data-status');
        const levelCell = row.querySelector('.editable-level');
        const actionCell = row.querySelector('.editable-action');
        const statusCell = row.querySelector('td:nth-child(5)');

        markRowModified(row, false);
        markCellModified(levelCell, false);
        markCellModified(actionCell, false);

        if (status === 'pending') {
            statusCell.textContent = 'Pending Save';
            markRowModified(row, true);
            markCellModified(levelCell, true);
            markCellModified(actionCell, true);
            return;
        }

        if (status === 'deleted') {
            statusCell.textContent = 'Pending Delete';
            markRowModified(row, true);
            return;
        }

        if (updatedRules[ruleId]) {
            statusCell.textContent = 'Modified';
            markRowModified(row, true);
            if (Object.prototype.hasOwnProperty.call(updatedRules[ruleId], 'level')) {
                markCellModified(levelCell, true);
            }
            if (Object.prototype.hasOwnProperty.call(updatedRules[ruleId], 'action')) {
                markCellModified(actionCell, true);
            }
            return;
        }

        statusCell.textContent = 'Saved';
    }

    function rebuildTableFromState() {
        rulesBody.innerHTML = '';
        allRows = [];

        // Existing rows from DB, excluding deleted ones, with updates applied
        BASE_EXISTING_RULES.forEach(baseRule => {
            const ruleId = String(baseRule.id);
            const isDeleted = deletedRules.includes(baseRule.id);
            const update = updatedRules[ruleId] || {};

            const row = buildRuleRow({
                id: baseRule.id,
                level: update.level ?? baseRule.level,
                page: baseRule.page,
                element: baseRule.element,
                action: update.action ?? baseRule.action,
                status: isDeleted ? 'deleted' : 'existing',
                statusText: isDeleted ? 'Pending Delete' : (updatedRules[ruleId] ? 'Modified' : 'Saved')
            });

            allRows.push(row);
        });

        // New unsaved rules
        newRules.forEach(rule => {
            const row = buildRuleRow({
                id: rule.temp_id,
                level: parseInt(rule.level, 10),
                page: rule.page,
                element: rule.element_desc || rule.element,
                action: rule.action,
                status: 'pending',
                statusText: 'Pending Save'
            });

            allRows.push(row);
        });

        allRows.forEach(row => applyStateToRowVisuals(row));

        applyFilters(false);
    }

    function restoreState(snapshot, pushToStorage = true) {
        newRules = JSON.parse(JSON.stringify(snapshot.newRules || []));
        deletedRules = JSON.parse(JSON.stringify(snapshot.deletedRules || []));
        updatedRules = JSON.parse(JSON.stringify(snapshot.updatedRules || {}));
        tempIdCounter = snapshot.tempIdCounter || 0;

        if (filterLevelSelect) filterLevelSelect.value = snapshot.filterLevel || '';
        if (filterPageSelect) filterPageSelect.value = snapshot.filterPage || '';

        currentPage = snapshot.currentPage || 1;

        rebuildTableFromState();
        syncTempCounter();

        if (pushToStorage) persistState();
        updateUndoRedoButtons();
    }

    function loadPersistedState() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        try {
            const saved = JSON.parse(raw);
            restoreState(saved, false);
        } catch (err) {
            console.error('Failed to restore permission state:', err);
            clearPersistedState();
        }
    }

    // ------------------------------------------------------------
    // PAGINATION
    // ------------------------------------------------------------
    function createPageButton(page, isActive = false) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = page;

        if (isActive) {
            btn.disabled = true;
            btn.classList.add('active-page');
        }

        btn.addEventListener('click', () => {
            currentPage = page;
            renderTablePage();
            persistState();
        });

        return btn;
    }

    function createDots() {
        const span = document.createElement('span');
        span.textContent = '...';
        return span;
    }

    function renderPageButtons() {
        if (!pageNumbers) return;

        pageNumbers.innerHTML = '';

        const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGINATION_PER_PAGE));
        currentPage = Math.min(Math.max(1, currentPage), totalPages);

        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, currentPage + 2);

        if (start > 1) {
            pageNumbers.appendChild(createPageButton(1, currentPage === 1));
            if (start > 2) pageNumbers.appendChild(createDots());
        }

        for (let i = start; i <= end; i++) {
            pageNumbers.appendChild(createPageButton(i, i === currentPage));
        }

        if (end < totalPages) {
            if (end < totalPages - 1) pageNumbers.appendChild(createDots());
            pageNumbers.appendChild(createPageButton(totalPages, currentPage === totalPages));
        }

        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages;
    }

    function renderTablePage() {
        rulesBody.innerHTML = '';

        const start = (currentPage - 1) * PAGINATION_PER_PAGE;
        const end = start + PAGINATION_PER_PAGE;
        const pageRows = filteredRows.slice(start, end);

        pageRows.forEach(row => {
            rulesBody.appendChild(row);
            applyStateToRowVisuals(row);
        });

        renderPageButtons();
    }

    // ------------------------------------------------------------
    // FILTERING
    // ------------------------------------------------------------
    function applyFilters(resetPage = true) {
        const levelFilter = filterLevelSelect ? filterLevelSelect.value : '';
        const pageFilter = filterPageSelect ? filterPageSelect.value : '';

        filteredRows = allRows.filter(row => {
            const rowLevel = row.getAttribute('data-level');
            const rowPage = row.getAttribute('data-page');

            const matchLevel = !levelFilter || rowLevel === levelFilter;
            const matchPage = !pageFilter || rowPage === pageFilter;

            return matchLevel && matchPage;
        });

        if (resetPage) currentPage = 1;
        renderTablePage();
        persistState();
    }

    if (filterLevelSelect) filterLevelSelect.addEventListener('change', () => applyFilters(true));
    if (filterPageSelect) filterPageSelect.addEventListener('change', () => applyFilters(true));

    // ------------------------------------------------------------
    // INLINE EDITING
    // ------------------------------------------------------------
    function createSelectElement(type, currentValue) {
        const select = document.createElement('select');
        select.className = type === 'level' ? 'edit-level-select' : 'edit-action-select';

        let initialValue;
        if (type === 'level') {
            const match = String(currentValue).match(/Level\s+(\d+)/i);
            initialValue = match ? parseInt(match[1], 10) : parseInt(currentValue, 10);

            for (const [id, desc] of Object.entries(LEVELS)) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `Level ${id} - ${desc}`;
                if (parseInt(id, 10) === initialValue) option.selected = true;
                select.appendChild(option);
            }
        } else {
            initialValue = String(currentValue).toLowerCase();
            ACTIONS.forEach(action => {
                const option = document.createElement('option');
                option.value = action;
                option.textContent = capitalize(action);
                if (action === initialValue) option.selected = true;
                select.appendChild(option);
            });
        }

        return select;
    }

    function makeEditable(row) {
        const levelCell = row.querySelector('.editable-level');
        const actionCell = row.querySelector('.editable-action');

        const currentLevel = levelCell.textContent.trim();
        const currentAction = actionCell.textContent.trim();

        const levelSelect = createSelectElement('level', currentLevel);
        const actionSelect = createSelectElement('action', currentAction);

        levelCell.innerHTML = '';
        levelCell.appendChild(levelSelect);

        actionCell.innerHTML = '';
        actionCell.appendChild(actionSelect);

        row.addEventListener('change', trackInlineChange);
        row.querySelector('.update-rule-button').textContent = 'Done Editing';
        row.querySelector('td:nth-child(5)').textContent = 'Editing';
    }

    function revertToText(row) {
        const levelCell = row.querySelector('.editable-level');
        const actionCell = row.querySelector('.editable-action');

        const levelSelect = levelCell.querySelector('select');
        const actionSelect = actionCell.querySelector('select');

        if (!levelSelect && !actionSelect) return;

        row.removeEventListener('change', trackInlineChange);

        if (levelSelect) {
            const levelId = levelSelect.value;
            levelCell.textContent = getLevelLabel(levelId);
            row.setAttribute('data-level', String(levelId));
        }

        if (actionSelect) {
            actionCell.textContent = capitalize(actionSelect.value);
        }

        row.querySelector('.update-rule-button').textContent = 'Update';
        applyStateToRowVisuals(row);
        persistState();
    }

    function trackInlineChange(event) {
        const target = event.target;
        if (target.tagName !== 'SELECT') return;

        const row = target.closest('tr');
        const ruleId = row.getAttribute('data-id');
        const levelSelect = row.querySelector('.edit-level-select');
        const actionSelect = row.querySelector('.edit-action-select');

        const newLevel = parseInt(levelSelect.value, 10);
        const newAction = actionSelect.value;

        row.querySelector('td:nth-child(5)').textContent = 'Modified';
        row.setAttribute('data-level', String(newLevel));

        if (!updatedRules[ruleId]) updatedRules[ruleId] = {};
        updatedRules[ruleId].level = newLevel;
        updatedRules[ruleId].action = newAction;

        markRowModified(row, true);
        markCellModified(row.querySelector('.editable-level'), true);
        markCellModified(row.querySelector('.editable-action'), true);

        persistState();
        applyFilters(false);
    }

    // ------------------------------------------------------------
    // PAGE/ELEMENT FORM
    // ------------------------------------------------------------
    pageSelect.addEventListener('change', function() {
        const selectedPage = this.value;
        elementSelect.innerHTML = '<option value="">-- Select Element --</option>';
        elementSelect.disabled = true;

        if (selectedPage && ELEMENTS_MAP[selectedPage]) {
            ELEMENTS_MAP[selectedPage].forEach(element => {
                const option = document.createElement('option');
                option.value = element.id;
                option.textContent = `${element.id} - ${element.desc}`;
                elementSelect.appendChild(option);
            });
            elementSelect.disabled = false;
        }
    });

    // ------------------------------------------------------------
    // ADD NEW RULE
    // ------------------------------------------------------------
    addRuleForm.addEventListener('submit', function(event) {
        event.preventDefault();

        if (!pageSelect.value || !elementSelect.value) {
            alert('Please select a Page and an Element.');
            return;
        }

        pushHistory();

        const newRule = {
            level: document.getElementById('level-select').value,
            page: pageSelect.value,
            element: elementSelect.value,
            action: document.getElementById('action-select').value
        };

        const elementDetails = ELEMENTS_MAP[newRule.page].find(e => e.id === newRule.element);
        const elementDesc = elementDetails ? elementDetails.desc : newRule.element;

        tempIdCounter++;
        const tempId = `temp-${tempIdCounter}`;

        newRules.push({
            ...newRule,
            element_desc: elementDesc,
            temp_id: tempId
        });

        rebuildTableFromState();
        persistState();

        addRuleForm.reset();
        elementSelect.innerHTML = '<option value="">-- Select Element --</option>';
        elementSelect.disabled = true;
    });

    // ------------------------------------------------------------
    // BUTTON DELEGATION
    // ------------------------------------------------------------
    rulesBody.addEventListener('click', function(event) {
        const target = event.target;
        const row = target.closest('tr');
        if (!row) return;

        const ruleId = row.getAttribute('data-id');
        const status = row.getAttribute('data-status');

        if (target.classList.contains('delete-rule-button')) {
            pushHistory();

            revertToText(row);

            if (status === 'existing') {
                const numericId = parseInt(ruleId, 10);

                if (deletedRules.includes(numericId)) {
                    deletedRules = deletedRules.filter(id => id !== numericId);
                    row.setAttribute('data-status', 'existing');
                } else {
                    if (confirm(`Mark SAVED rule ${ruleId} for deletion?`)) {
                        deletedRules.push(numericId);
                        row.setAttribute('data-status', 'deleted');
                    }
                }
            } else if (status === 'pending') {
                newRules = newRules.filter(r => r.temp_id !== ruleId);
            } else if (status === 'deleted') {
                const numericId = parseInt(ruleId, 10);
                deletedRules = deletedRules.filter(id => id !== numericId);
                row.setAttribute('data-status', 'existing');
            }

            delete updatedRules[ruleId];
            rebuildTableFromState();
            persistState();
        }

        if (target.classList.contains('update-rule-button')) {
            if (row.querySelector('select')) {
                revertToText(row);
                alert('Changes recorded. Click "Save All Rules" to commit to database.');
            } else {
                pushHistory();
                makeEditable(row);
                persistState();
            }
        }
    });

    // ------------------------------------------------------------
    // UNDO / REDO
    // ------------------------------------------------------------
    if (undoButton) {
        undoButton.addEventListener('click', () => {
            if (undoStack.length === 0) return;

            const currentSnapshot = createHistorySnapshot();
            redoStack.push(currentSnapshot);

            const previous = undoStack.pop();
            restoreState(previous);
            updateUndoRedoButtons();
        });
    }

    if (redoButton) {
        redoButton.addEventListener('click', () => {
            if (redoStack.length === 0) return;

            const currentSnapshot = createHistorySnapshot();
            undoStack.push(currentSnapshot);

            const next = redoStack.pop();
            restoreState(next);
            updateUndoRedoButtons();
        });
    }

    // ------------------------------------------------------------
    // SAVE ALL
    // ------------------------------------------------------------
    saveAllButton.addEventListener('click', function() {
        const updatesArray = Object.keys(updatedRules)
            .filter(id => !String(id).startsWith('temp-'))
            .map(id => {
                const update = updatedRules[id];
                return { id: parseInt(id, 10), ...update };
            });

        const totalChanges = newRules.length + deletedRules.length + updatesArray.length;

        if (totalChanges === 0) {
            alert('No changes (new, deleted, or updated) to save.');
            return;
        }

        if (!confirm(`Confirm saving ${newRules.length} new, ${deletedRules.length} deleted, and ${updatesArray.length} updated rule(s)?`)) {
            return;
        }

        fetch('/save-permission-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                new_rules: newRules.map(r => ({
                    level: r.level,
                    page: r.page,
                    element: r.element,
                    action: r.action
                })),
                deleted_rules: deletedRules,
                updates: updatesArray
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => Promise.reject(data.error || 'Server error'));
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                clearPersistedState();
                alert('Permission rules updated successfully. Page will now reload.');
                window.location.reload();
            } else {
                alert('Error saving rules: ' + (data.error || 'Unknown error.'));
            }
        })
        .catch(error => {
            console.error('Error during save:', error);
            alert(`An unexpected error occurred: ${error}`);
        });
    });

    // ------------------------------------------------------------
    // PAGINATION BUTTON EVENTS
    // ------------------------------------------------------------
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTablePage();
                persistState();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGINATION_PER_PAGE));
            if (currentPage < totalPages) {
                currentPage++;
                renderTablePage();
                persistState();
            }
        });
    }

    // ------------------------------------------------------------
    // INIT
    // ------------------------------------------------------------
    loadPersistedState();

    if (!localStorage.getItem(STORAGE_KEY)) {
        rebuildTableFromState();
    }

    updateUndoRedoButtons();
});