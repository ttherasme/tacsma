document.addEventListener("DOMContentLoaded", () => {
    const formRowsContainer = document.getElementById("form-rows");
    const runButton = document.querySelector(".run-button");

    if (!formRowsContainer) {
        console.error("form-rows not found");
        return;
    }

    const idd = formRowsContainer.dataset.uocId;

    if (!runButton) {
        console.error("run-button not found");
        return;
    }

    async function loadCanonicalUnits(selectElement, selectedValue = "") {
        try {
            const response = await fetch("/list_uocs/2");
            const data = await response.json();

            selectElement.innerHTML = `<option value="">Select unit...</option>`;

            data.forEach(uoc => {
                const option = document.createElement("option");
                option.value = uoc.Unit;
                option.textContent = uoc.Unit;

                if (uoc.Unit === selectedValue) {
                    option.selected = true;
                }

                selectElement.appendChild(option);
            });
        } catch (error) {
            console.error("Error loading canonical units:", error);
        }
    }

    const uocRow = formRowsContainer.querySelector(".form-row");
    if (uocRow) {
        const unitSelect = uocRow.querySelector(".uoc-unit");
        if (unitSelect) {
            const selectedUnit = unitSelect.dataset.selected || "";
            loadCanonicalUnits(unitSelect, selectedUnit);
        }
    }

    runButton.addEventListener("click", () => {
        const uocRow = formRowsContainer.querySelector(".form-row");
        if (!uocRow) {
            alert("No Alias Unit of Conversion data to update.");
            return;
        }

        const idEl = uocRow.querySelector(".uoc-id");
        const aliasEl = uocRow.querySelector(".uoc-name");
        const unitEl = uocRow.querySelector(".uoc-unit");
        const stateEl = uocRow.querySelector(".uoc-state");

        if (!idEl || !aliasEl || !unitEl || !stateEl) {
            alert("Some form fields are missing.");
            console.error({ idEl, aliasEl, unitEl, stateEl });
            return;
        }

        const id = idEl.value;
        const alias = aliasEl.value.trim();
        const canonicalUnit = unitEl.value.trim();
        const state = parseInt(stateEl.value, 10);

        if (!id) {
            alert("Alias Unit ID is missing. Cannot update.");
            return;
        }

        if (!alias || !canonicalUnit) {
            alert("Alias and Canonical Unit are required.");
            return;
        }

        if (isNaN(state) || (state !== 0 && state !== 1)) {
            alert("Invalid state value. Please select Active or Inactive.");
            return;
        }

        const confirmed = confirm("Are you sure you want to update this Alias Unit of Conversion?");
        if (!confirmed) return;

        fetch("/updateauoc", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                IDU: id,
                UAlias: alias,
                CanonicalUnit: canonicalUnit,
                State: state
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert(data.message || "Alias Unit of Conversion updated successfully.");
                window.location.href = `/auoc?id=${idd}`;
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