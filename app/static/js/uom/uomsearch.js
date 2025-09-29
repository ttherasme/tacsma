document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("uom-search-input");
    const tableBody = document.getElementById("uom-table-body");
    const searchButton = document.querySelector(".uom-search .search-btn"); // Get the search button

    // Render UOM table rows
    function updateTable(uomData) {
        tableBody.innerHTML = ""; // Clear existing rows

        if (uomData.length === 0) {
            tableBody.innerHTML = "<tr><td colspan='6'>No results found</td></tr>"; // colspan should match number of columns
            return;
        }

        uomData.forEach(uom => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${uom.IDU}</td>
                <td>${uom.UName}</td>
                <td>${uom.Unit}</td>
                <td>${uom.State}</td>
                <td>${uom.EntryDate}</td>
                <td>
                    <input type="checkbox" class="uom-checkbox" data-id="${uom.IDU}">
                </td>
            `;
            tableBody.appendChild(row);
        });

        attachCheckboxBehavior(); // Re-attach checkbox behavior after updating table
    }

    // Ensure only one checkbox is selected at a time
    function attachCheckboxBehavior() {
        const checkboxes = document.querySelectorAll(".uom-checkbox");

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

    // Search and update the table
    function searchUOMs(query) {
        fetch(`/searchuoms?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                updateTable(data);
            })
            .catch(error => {
                console.error("Search failed:", error);
                tableBody.innerHTML = "<tr><td colspan='6'>Error loading results</td></tr>"; // colspan should match
            });
    }

    // Event: auto search on input
    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim();
        searchUOMs(query);
    });

    // Event: Search on button click (optional, as input event already handles it)
    searchButton.addEventListener("click", () => {
        const query = searchInput.value.trim();
        searchUOMs(query);
    });

    // Load default UOMs initially when the page loads
    searchUOMs("");
});