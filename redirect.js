const cabinetURL = new URL('./jury/', window.location.href);
cabinetURL.search = window.location.search;
cabinetURL.hash = window.location.hash;
window.location.replace(cabinetURL.href);
