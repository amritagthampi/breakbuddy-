// content.js — Digital Wellness Break v2.0
console.log("[Content] Digital Wellness Break script loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Content] Received:", request.action);

    if (request.action === "SHOW_BREAK") {
        showOverlay();
        sendResponse({ status: "shown" });
    } else if (request.action === "HIDE_BREAK") {
        removeOverlay();
        sendResponse({ status: "hidden" });
    }

    return true;
});

function showOverlay() {
    if (document.getElementById("wellness-overlay-frame")) return;

    const frame = document.createElement("iframe");
    frame.id = "wellness-overlay-frame";
    frame.src = chrome.runtime.getURL("overlay.html");

    Object.assign(frame.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        border: "none",
        zIndex: "2147483647",
        background: "transparent",
        opacity: "0",
        transition: "opacity 0.4s ease",
    });

    document.documentElement.appendChild(frame);

    // Fade in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            frame.style.opacity = "1";
        });
    });
}

function removeOverlay() {
    const frame = document.getElementById("wellness-overlay-frame");
    if (!frame) return;

    frame.style.opacity = "0";
    setTimeout(() => frame.remove(), 400);
}
