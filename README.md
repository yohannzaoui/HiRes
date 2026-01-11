---

# HiFi Audio Player 🎧

A sleek, high-fidelity web-based audio station designed for desktop enthusiasts. This application offers a premium dark-themed interface with a golden "HiFi" aesthetic, professional-grade controls, and full PWA (Progressive Web App) support for a native desktop experience.

## ✨ Key Features

* **Premium HiFi UI**: A sophisticated dark mode interface featuring a golden radial glow (halo effect) and a minimalist, scannable layout.
* **High-Resolution Audio Support**: Designed to handle high-quality formats like **FLAC**, **WAV**, and **MP3**.
* **PWA Ready**: Can be installed as a standalone application on **Windows, macOS, and Linux**.
* **Smart Metadata**: Automatically extracts song titles, artist names, and album artwork using `jsmediatags`.
* **Persistent Settings**: Your volume preferences are automatically saved to your browser's local storage.
* **Desktop-Optimized**: Custom-built for large screens with a dedicated blocker for mobile devices to ensure the best UX.
* **Apple Compatibility**: Fully optimized for Safari with specific meta-tags for a "Web Clip" experience.

## 🛠️ Technical Stack

* **Frontend**: HTML5, CSS3 (Custom Properties & Flexbox), Bootstrap 5.
* **Icons**: FontAwesome 6.
* **Library**: [jsmediatags](https://github.com/aadsm/jsmediatags) for audio metadata processing.
* **Installation**: Service Workers & Manifest.json for PWA functionality.

```

## 🚀 Installation & Setup

1. **Clone or Download**: Save all files into a single directory.
2. **Hosting**: Since this is a PWA, it requires a local server or web hosting to enable the "Install" button.
* *Option A (Local)*: Use the **Live Server** extension in VS Code.
* *Option B (Online)*: Upload to GitHub Pages, Vercel, or Netlify.


3. **Install as App**:
* Open the app in Chrome or Edge.
* Click the **Install Icon** in the address bar.
* The HiFi Player will now appear in your Start Menu / Applications folder.



## 🎵 How to Use

1. Click **ADD FILES** to import your music collection.
2. Use the **Shuffle** and **Repeat** buttons to customize your listening experience.
3. Adjust the volume via the custom slider (your level will be remembered for the next session).
4. Manage your queue using the **Clear** button to reset the playlist.

---
