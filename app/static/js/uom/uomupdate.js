document.addEventListener("DOMContentLoaded", () => {
    const formRowsContainer = document.getElementById("form-rows");
    const runButton = document.querySelector(".run-button");

    // The initial rendering is now handled by Jinja2 in uomupdate.html
    // So, we can remove the renderUOMForm function and the initial fetch call for uomId.

    // No need to fetch initial data here; Jinja handles it on page load.
    // If you need to ensure fields are populated, you can add a check,
    // but the HTML with Jinja will ensure they're pre-filled.

    // Event listener for the Update button
    runButton.addEventListener("click", () => {
        const uomRow = formRowsContainer.querySelector(".form-row");
        if (!uomRow) {
            alert("No Unit of Measure data to update.");
            return;
        }

        const id = uomRow.querySelector(".uom-id").value;
        const name = uomRow.querySelector(".uom-name").value.trim();
        const unit = uomRow.querySelector(".uom-unit").value.trim();
        const state = parseInt(uomRow.querySelector(".uom-state").value, 10);

        if (!id) {
            alert("Unit of Measure ID is missing. Cannot update.");
            return;
        }

        if (!name || !unit) {
            alert("Unit Name and Unit Abbreviation are required.");
            return;
        }

        if (isNaN(state) || (state !== 0 && state !== 1)) {
            alert("Invalid state value. Please select Active or Inactive.");
            return;
        }

        const confirmed = confirm("Are you sure you want to update this Unit of Measure?");
        if (!confirmed) return;

        fetch("/updateuom", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                IDU: id,
                UName: name,
                Unit: unit,
                State: state
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(data.message || "Unit of Measure updated successfully.");
                window.location.href = "/uom";
            } else {
                alert("Error: " + (data.message || "An unknown error occurred."));
            }
        })
        .catch(err => {
            console.error("Error:", err);
            alert("Unexpected error occurred during update.");
        });
    });
});