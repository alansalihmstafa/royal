const searchBar = document.getElementById("searchBar");
const contactForm = document.getElementById("contactForm");

/* Search apps + hidden admin access */

searchBar.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        const value = searchBar.value.trim().toLowerCase();

        if (value === "@admin") {
            window.location.href = "admin.html";
        }
    }
});

searchBar.addEventListener("input", function () {
    const value = searchBar.value.toLowerCase();
    const cards = document.querySelectorAll(".app-card");

    cards.forEach(function (card) {
        const text = card.innerText.toLowerCase();

        if (text.includes(value)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
});

/* Contact form demo */

contactForm.addEventListener("submit", function (event) {
    event.preventDefault();

    alert("Message sent! This is a demo form. To receive messages, you need Formspree, Netlify Forms, or backend.");

    contactForm.reset();
});