document.addEventListener("DOMContentLoaded", () => {
  const runButton = document.querySelector(".run-button");

  runButton.addEventListener("click", () => {
    const id = document.getElementById("task-id").value;
    const name = document.querySelector(".task-name").value.trim();
    const detail = document.querySelector(".task-detail").value.trim();

    if (!id || !name) {
      alert("Task name is required.");
      return;
    }

    const confirmed = confirm("Are you sure you want to update this task?");
    if (!confirmed) return;

    fetch("/updatetask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        IDT: id,
        TName: name,
        Description: detail
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert("Task updated successfully.");
        window.location.href = "/tasks";
      } else {
        alert("Error: " + data.message);
      }
    })
    .catch(err => {
      console.error("Error:", err);
      alert("Unexpected error occurred.");
    });
  });
});
