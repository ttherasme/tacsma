document.addEventListener("DOMContentLoaded", () => {
    const formRowsContainer = document.getElementById("form-rows");
    const runButton = document.querySelector(".run-button");

    if (!formRowsContainer) {
        console.error("form-rows not found");
        return;
    }

    if (!runButton) {
        console.error("run-button not found");
        return;
    }

    runButton.addEventListener("click", () => {
        const uocRow = formRowsContainer.querySelector(".form-row");
        if (!uocRow) {
            alert("No Unit of Conversion data to update.");
            return;
        }

        const idEl = uocRow.querySelector(".uoc-id");
        const nameEl = uocRow.querySelector(".uoc-name");
        const factorEl = uocRow.querySelector(".uoc-factor");
        const unitEl = uocRow.querySelector(".uoc-unit");
        const categoryEl = uocRow.querySelector(".uoc-category");
        const stateEl = uocRow.querySelector(".uoc-state");

        if (!idEl || !nameEl || !factorEl || !unitEl || !categoryEl || !stateEl) {
            alert("Some form fields are missing.");
            console.error({
                idEl, nameEl, factorEl, unitEl, categoryEl, stateEl
            });
            return;
        }

        const id = idEl.value;
        const name = nameEl.value.trim();
        const factor = factorEl.value;
        const unit = unitEl.value.trim();
        const category = categoryEl.value.trim();
        const state = parseInt(stateEl.value, 10);

        if (!id) {
            alert("Unit of Conversion ID is missing. Cannot update.");
            return;
        }

        if (!name || !unit || !factor==="" || !category) {
            alert("Unit Name, factor, SI Unit and category are required.");
            return;
        }

        if (isNaN(state) || (state !== 0 && state !== 1)) {
            alert("Invalid state value. Please select Active or Inactive.");
            return;
        }

        const confirmed = confirm("Are you sure you want to update this Unit of Conversion?");
        if (!confirmed) return;

        fetch("/updateuoc", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                IDU: id,
                UName: name,
                UFactor: factor,
                Unit: unit,
                UCategory: category,
                State: state
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(data.message || "Unit of Conversion updated successfully.");
                window.location.href = "/uoc";
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