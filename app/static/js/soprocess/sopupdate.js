document.addEventListener("DOMContentLoaded", () => {
    // Get step data passed from Flask via embedded JSON
    const stepDataElement = document.getElementById("step-data");
    let stepData = null;

    if (stepDataElement) {
        try {
            stepData = JSON.parse(stepDataElement.textContent);
        } catch (e) {
            console.error("Error parsing step data:", e);
            alert("Failed to load Step of Process data due to a data format error.");
        }
    }

    const nameInput = document.querySelector(".step-name");
    const stateSelect = document.querySelector(".sop-state");
    const updateButton = document.querySelector(".run-button");
    // Get the hidden ID input field
    const idInput = document.querySelector(".step-id"); 

    if (!stepData || !stepData.IDS) {
        alert("No Step of Process data found for update. Please ensure an ID is provided.");
        updateButton.disabled = true;
        // Optionally, hide the form or show a message
        if (nameInput) nameInput.disabled = true;
        if (stateSelect) stateSelect.disabled = true;
        return;
    }

    // Populate form fields using the hidden input for ID and the stepData for others
    if (idInput) idInput.value = stepData.IDS;
    if (nameInput) nameInput.value = stepData.SName || "";
    if (stateSelect) stateSelect.value = String(stepData.State);


    updateButton.addEventListener("click", async () => {
        const updatedName = nameInput.value.trim();
        const updatedState = parseInt(stateSelect.value, 10);
        // Get the ID from the hidden input field
        const idToUpdate = idInput.value; 

        if (!idToUpdate) {
            alert("Step ID is missing. Cannot update.");
            return;
        }

        if (!updatedName) {
            alert("Step name cannot be empty.");
            return;
        }

        const payload = {
            IDS: idToUpdate, // Use the ID from the hidden input
            SName: updatedName,
            State: updatedState
        };

        try {
            const response = await fetch("/updatesop", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert("Step of Process updated successfully.");
                // Optionally redirect or reload:
                window.location.href = "/stepofprocess";
            } else {
                alert("Update failed: " + result.message);
            }
        } catch (err) {
            console.error("Update error:", err);
            alert("An unexpected error occurred.");
        }
    });
});