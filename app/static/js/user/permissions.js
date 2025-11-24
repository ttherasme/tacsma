document.addEventListener('DOMContentLoaded', function() {
    const pageSelect = document.getElementById('page-select');
    const elementSelect = document.getElementById('element-select');
    const addRuleForm = document.getElementById('add-rule-form');
    const rulesBody = document.getElementById('permission-rules-body');
    const saveAllButton = document.getElementById('save-all-rules');
    
    const filterLevelSelect = document.getElementById('filter-level');
    const filterPageSelect = document.getElementById('filter-page');

    // Load data passed from Flask template (level.html)
    const elementsMapData = document.getElementById('elements-map-data').textContent;
    const levelsData = document.getElementById('levels-data').textContent;
    const actionsData = document.getElementById('actions-data').textContent;
    
    const ELEMENTS_MAP = JSON.parse(elementsMapData); 
    const LEVELS = JSON.parse(levelsData);     // {1: 'ReadOnly User', ...}
    const ACTIONS = JSON.parse(actionsData);   // ['view', 'click', ...]

    // State tracking variables
    let newRules = [];
    let deletedRules = [];
    let updatedRules = {}; // {ruleId: {level: 2, action: 'view'}, ...}
    let tempIdCounter = 0; 
    
    // Store original HTML rows for filtering reference
    const allRows = Array.from(rulesBody.querySelectorAll('tr'));


    // ----------------------------------------------------------------------
    // 1. FILTERING LOGIC
    // ----------------------------------------------------------------------
    function applyFilters() {
        const levelFilter = filterLevelSelect.value;
        const pageFilter = filterPageSelect.value;

        allRows.forEach(row => {
            const rowLevel = row.getAttribute('data-level');
            const rowPage = row.getAttribute('data-page');
            
            const matchLevel = !levelFilter || rowLevel === levelFilter;
            const matchPage = !pageFilter || rowPage === pageFilter;

            row.style.display = (matchLevel && matchPage) ? '' : 'none';
        });
    }

    filterLevelSelect.addEventListener('change', applyFilters);
    filterPageSelect.addEventListener('change', applyFilters);


    // ----------------------------------------------------------------------
    // 2. INLINE EDITING LOGIC (Using Selects)
    // ----------------------------------------------------------------------
    
    /** Creates a select element populated with allowed options (Levels or Actions). */
    function createSelectElement(type, currentValue) {
        const select = document.createElement('select');
        select.className = type === 'level' ? 'edit-level-select' : 'edit-action-select';
        
        let initialValue = type === 'level' ? parseInt(currentValue) : currentValue.toLowerCase();

        if (type === 'level') {
            // Populate Level options (ID as value, ID + description as text)
            for (const [id, desc] of Object.entries(LEVELS)) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = `Level ${id} - ${desc}`;
                if (parseInt(id) === initialValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        } else { // Action
            // Populate Action options
            ACTIONS.forEach(action => {
                const option = document.createElement('option');
                option.value = action;
                option.textContent = action.charAt(0).toUpperCase() + action.slice(1);
                if (action === initialValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
        return select;
    }

    /** Replaces the text content of Level and Action cells with dynamic select elements. */
    function makeEditable(row) {
        const levelCell = row.querySelector('.editable-level');
        const actionCell = row.querySelector('.editable-action');
        
        // Use text content as the current value
        const currentLevel = levelCell.textContent.trim();
        const currentAction = actionCell.textContent.trim();
        
        // 1. Create and inject select for Level
        const levelSelect = createSelectElement('level', currentLevel);
        levelCell.innerHTML = '';
        levelCell.appendChild(levelSelect);
        
        // 2. Create and inject select for Action
        const actionSelect = createSelectElement('action', currentAction);
        actionCell.innerHTML = '';
        actionCell.appendChild(actionSelect);
        
        // 3. Attach a single change listener to the row to track updates
        row.addEventListener('change', trackInlineChange);
        
        // Update the status column
        row.querySelector('td:nth-child(5)').textContent = 'Editing';
    }
    
    /** Reverts the select elements back to displaying text content. */
     function revertToText(row) {
        const levelCell = row.querySelector('.editable-level');
        const actionCell = row.querySelector('.editable-action');
        
        const levelSelect = levelCell.querySelector('select');
        const actionSelect = actionCell.querySelector('select');
        
        if (!levelSelect && !actionSelect) return; // Not in editing mode
        
        // Remove the listener
        row.removeEventListener('change', trackInlineChange);
        
        // Revert Level cell (CRITICAL UPDATE HERE)
        if (levelSelect) {
            const levelId = levelSelect.value;
            const levelDesc = LEVELS[levelId];
            
            // Display the descriptive format: "Level ID - Description"
            levelCell.textContent = `Level ${levelId} - ${levelDesc}`;
            
            // Ensure data-level is updated for filtering
            row.setAttribute('data-level', levelId); 
        }
        
        // Revert Action cell
        if (actionSelect) {
            const actionValue = actionSelect.value;
            actionCell.textContent = actionValue.charAt(0).toUpperCase() + actionValue.slice(1);
        }
    }

    /** Tracks changes made via the inline select elements. */
    function trackInlineChange(event) {
        const target = event.target;
        if (target.tagName !== 'SELECT') return;

        const row = target.closest('tr');
        const ruleId = row.getAttribute('data-id');
        
        const levelSelect = row.querySelector('.edit-level-select');
        const actionSelect = row.querySelector('.edit-action-select');
        
        // Get the current committed values from the selects
        const newLevel = parseInt(levelSelect.value);
        const newAction = actionSelect.value;
        
        // Update status and track change
        row.querySelector('td:nth-child(5)').textContent = 'Modified'; 
        
        if (!updatedRules[ruleId]) {
            updatedRules[ruleId] = {};
        }
        updatedRules[ruleId]['level'] = newLevel;
        updatedRules[ruleId]['action'] = newAction;
        
        // Also update the row's data-level attribute for immediate filtering consistency
        row.setAttribute('data-level', newLevel);
        applyFilters(); 
    }


    // ----------------------------------------------------------------------
    // 3. ADD NEW RULE LOGIC
    // ----------------------------------------------------------------------
    
    // Element Select Population Logic (for the main form)
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
    
    // Add Rule to Table
    addRuleForm.addEventListener('submit', function(event) {
        event.preventDefault();

        if (!pageSelect.value || !elementSelect.value) {
            alert("Please select a Page and an Element.");
            return;
        }

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
        newRules.push({ ...newRule, temp_id: tempId });

        const newRow = rulesBody.insertRow();
        newRow.setAttribute('data-id', tempId);
        newRow.setAttribute('data-status', 'pending');
        newRow.setAttribute('data-level', newRule.level); 
        newRow.setAttribute('data-page', newRule.page);   

        newRow.innerHTML = `
            <td class="editable-level">${newRule.level}</td>
            <td>${newRule.page.charAt(0).toUpperCase() + newRule.page.slice(1)}</td>
            <td>${elementDesc}</td>
            <td class="editable-action">${newRule.action.charAt(0).toUpperCase() + newRule.action.slice(1)}</td>
            <td>Pending Save</td>
           <td><button class="update-rule-button">Update</button><button class="delete-rule-button">Delete</button></td>
        `;

        allRows.push(newRow); 
        applyFilters();       

        addRuleForm.reset();
        elementSelect.innerHTML = '<option value="">-- Select Element --</option>';
        elementSelect.disabled = true;
    });


    // ----------------------------------------------------------------------
    // 4. BUTTON DELEGATION (Delete & Update)
    // ----------------------------------------------------------------------
    rulesBody.addEventListener('click', function(event) {
        const target = event.target;
        const row = target.closest('tr');
        if (!row) return;

        const ruleId = row.getAttribute('data-id');
        const status = row.getAttribute('data-status');
        const updateButton = row.querySelector('.update-rule-button');

        // DELETE BUTTON
        if (target.classList.contains('delete-rule-button')) {
            revertToText(row); // Revert editing mode if active
            
            if (status === 'existing') {
                if (confirm(`Mark SAVED rule ${ruleId} for deletion?`)) {
                    deletedRules.push(parseInt(ruleId));
                    row.setAttribute('data-status', 'deleted');
                }
            } else if (status === 'pending') {
                const index = newRules.findIndex(r => r.temp_id === ruleId);
                if (index !== -1) newRules.splice(index, 1);
                row.remove();
            } else if (status === 'deleted') {
                const index = deletedRules.indexOf(parseInt(ruleId));
                if (index !== -1) deletedRules.splice(index, 1);
                row.setAttribute('data-status', 'existing');
            }
            
            delete updatedRules[ruleId]; // Remove from updates if being deleted

        // UPDATE BUTTON (Toggles inline edit mode)
        } else if (target.classList.contains('update-rule-button')) {
            if (row.querySelector('select')) {
                // Currently in editing mode: Commit changes locally and revert
                revertToText(row);
                updateButton.textContent = 'Update';
                alert('Changes recorded. Click "Save All Rules" to commit to database.');
            } else {
                // Not in editing mode: Initiate edit
                makeEditable(row);
                updateButton.textContent = 'Done Editing';
            }
        }
    });

    // ----------------------------------------------------------------------
    // 5. SAVE ALL RULES LOGIC
    // ----------------------------------------------------------------------
    saveAllButton.addEventListener('click', function() {
        // Prepare updatedRules for backend
        const updatesArray = Object.keys(updatedRules).map(id => {
            const update = updatedRules[id];
            return { id: parseInt(id), ...update };
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
                new_rules: newRules,
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
});