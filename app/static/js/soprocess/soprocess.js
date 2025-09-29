// app/static/js/soprocess/soprocess.js

document.addEventListener("DOMContentLoaded", () => {
    // Correct element IDs to match the stepofprocess.html
    const searchInput = document.getElementById("sop-search-input");
    const tableBody = document.getElementById("sop-table-body");

    // Render step table rows
    function updateTable(rows) {
        tableBody.innerHTML = ""; // Clear existing rows

        if (rows.length === 0) {
            // Updated colspan to 5 (ID, Name, State, Entry Date, Checkbox)
            tableBody.innerHTML = "<tr><td colspan='5'>No results found</td></tr>";
            return;
        }

        rows.forEach(step => { // Change 'task' to 'step'
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${step.IDS}</td>        <td>${step.SName}</td>      <td>${step.State}</td>
                <td>${step.EntryDate}</td>  <td>
                    <input type="checkbox" class="sop-checkbox" data-id="${step.IDS}">
                </td>
            `;
            tableBody.appendChild(row);
        });

        attachCheckboxBehavior();
    }

    // Ensure only one checkbox is selected at a time (renamed class)
    function attachCheckboxBehavior() {
        const checkboxes = document.querySelectorAll(".sop-checkbox"); // Change class

        checkboxes.forEach(box => {
            box.addEventListener("change", () => {
                if (box.checked) {
                    checkboxes.forEach(other => {
                        if (other !== box) other.checked = false;
                    });
                }
            });
        });
    }

    // Search and update the table (renamed function and URL)
    function searchSops(query) { // Change function name
        fetch(`/searchsops?q=${encodeURIComponent(query)}`) // Correct URL to /searchsops
            .then(response => response.json())
            .then(data => {
                updateTable(data);
            })
            .catch(error => {
                console.error("Search failed:", error);
                tableBody.innerHTML = "<tr><td colspan='5'>Error loading results</td></tr>";
            });
    }

    // Event: auto search on input
    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim();
        searchSops(query); // Call the correct search function
    });

    // Load default steps initially
    searchSops("");
});