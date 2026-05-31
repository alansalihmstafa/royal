const search =
document.getElementById("searchBar");

search.addEventListener("input",()=>{

    const value =
    search.value.toLowerCase();

    document
    .querySelectorAll(".card")
    .forEach(card=>{

        const text =
        card.innerText.toLowerCase();

        card.style.display =
        text.includes(value)
        ? "block"
        : "none";

    });

});