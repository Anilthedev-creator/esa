document.addEventListener("DOMContentLoaded", () => {
    loadAboutContent();
});

async function loadAboutContent() {

    try {

        const response = await fetch("/about");

        if (!response.ok) {
            throw new Error("Failed to load content.");
        }

        const data = await response.json();

        if (data.story != null)
            document.getElementById("story").textContent = data.story;

        if (data.heading1 != null)
            document.getElementById("heading1").textContent = data.heading1;

        if (data.paragraph1 != null)
            document.getElementById("paragraph1").textContent = data.paragraph1;

        if (data.heading2 != null)
            document.getElementById("heading2").textContent = data.heading2;

        if (data.paragraph2 != null)
            document.getElementById("paragraph2").textContent = data.paragraph2;

        if (data.specialist1Name != null)
            document.getElementById("specialist1Name").textContent = data.specialist1Name;

        if (data.specialist1Position != null)
            document.getElementById("specialist1Position").textContent = data.specialist1Position;

        if (data.specialist1Biography != null)
            document.getElementById("specialist1Biography").textContent = data.specialist1Biography;

        if (data.specialist2Name != null)
            document.getElementById("specialist2Name").textContent = data.specialist2Name;

        if (data.specialist2Position != null)
            document.getElementById("specialist2Position").textContent = data.specialist2Position;

        if (data.specialist2Biography != null)
            document.getElementById("specialist2Biography").textContent = data.specialist2Biography;

        console.log("Information has been loaded successfully");

    } catch (error) {
        console.error(error);
        alert("Unable to load about page content.");
    }
}