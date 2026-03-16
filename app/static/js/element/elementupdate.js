document.addEventListener("DOMContentLoaded", () => {

    const updateBtn = document.querySelector(".run-button");
    const nameInput = document.querySelector(".element-name");
    const idInput = document.querySelector(".element-id");

    if (!updateBtn) return;

    updateBtn.addEventListener("click", async () => {

        const newName = nameInput.value.trim();
        const elementId = idInput.value;

        if (!newName) {
            alert("Element name cannot be empty.");
            return;
        }

        // ✅ User confirmation
        const confirmUpdate = confirm("Are you sure you want to update this element?");

        if (!confirmUpdate) {
            return; // user cancelled
        }

        try {

            const response = await fetch("/update_element_post", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    IDE: elementId,
                    EName: newName
                })
            });

            const data = await response.json();

            if (data.success) {
                alert("Element updated successfully.");
                window.location.href = "/elements";
            } else {
                alert(data.message || "Update failed.");
            }

        } catch (error) {
            console.error(error);
            alert("Server error while updating element.");
        }

    });

});