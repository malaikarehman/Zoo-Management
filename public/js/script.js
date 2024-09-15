function toggleContrast() {
    document.body.classList.toggle('high-contrast');
}

function adjustTextSize(scaleFactor) {
    const content = document.getElementById('content');
    content.style.fontSize = scaleFactor > 1 ? 'larger' : 'smaller';
}
