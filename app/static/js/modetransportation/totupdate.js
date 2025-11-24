document.getElementById("update-form").addEventListener("submit", function(e) {
  e.preventDefault();

  // Get form data
  const formData = {
    IDM: document.querySelector('input[name="IDM"]').value,
    MTName: document.querySelector('input[name="MTName"]').value,
    State: document.querySelector('select[name="State"]').value
  };

  // User confirmation step
  const confirmUpdate = confirm("Are you sure you want to update this transportation mode?");

  // If the user clicks "Cancel", stop the submission
  if (!confirmUpdate) {
    console.log("Update cancelled by user.");
    return; // Exit the function, preventing the fetch request
  }

  // If the user clicks "OK", proceed with the fetch request
  fetch("/updatetot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(formData)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      alert("Updated successfully!");
      window.location.href = "/typeoftransportation";
    } else {
      alert("Update failed: " + data.message);
    }
  })
  .catch(error => {
    alert("Error: " + error);
  });
});