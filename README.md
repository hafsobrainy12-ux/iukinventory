# Inventory Manager

A self-hosted inventory management web app with barcode label printing and
barcode scanning (USB scanner or phone/laptop camera). Data is stored in a
local SQLite database file — no cloud account or internet connection needed.

## Features

- **Dashboard** — total items, total units, inventory value, low-stock alerts
- **Items** — add, edit, delete, search and filter items (by name, barcode,
  category, supplier, location); stock adjustments are logged
- **Barcodes** — every item gets a barcode automatically (or set your own);
  generate a printable sheet of barcode labels to stick on products
- **Scanning** — look items up by barcode using a USB/keyboard-wedge barcode
  scanner, or your device's camera
- **Multi-device** — run it on one computer and have your staff use it from
  their own phones/laptops over your WiFi/LAN

## 1. Install

You need [Node.js](https://nodejs.org) (v18 or newer) installed on the
computer that will run the app (this can be a shop PC, a back-office
computer, etc. — it stays on while staff use the app).

```bash
cd inventory-app
npm install
```

## 2. Run it

```bash
npm start
```

You'll see:

```
Inventory app running:
  On this computer:  http://localhost:3000
  On your network:   http://<this-computer's-LAN-IP>:3000
```

- On the **same computer**: open `http://localhost:3000` in a browser.
- On **other devices** (staff phones, tablets, other PCs on the same
  WiFi/network): find this computer's LAN IP address and open
  `http://<that-ip>:3000` in a browser.

### Finding the computer's LAN IP address

- **Windows**: open Command Prompt, run `ipconfig`, look for "IPv4 Address"
  (usually starts with `192.168.` or `10.`).
- **Mac**: System Settings → Network → Wi-Fi/Ethernet → shows the IP address.
- **Linux**: run `hostname -I` or `ip addr`.

Example: if the computer's IP is `192.168.1.20`, staff on the same network
open `http://192.168.1.20:3000` on their own phone or laptop's browser.

> The app must keep running on that one computer (don't close the terminal
> window) for others to reach it. To keep it running in the background, you
> can use a tool like `pm2` (`npm install -g pm2 && pm2 start server.js`).

### Firewall note

If other devices can't connect, your computer's firewall may be blocking
incoming connections on port 3000. Allow inbound connections on port 3000
(Windows: Windows Defender Firewall → Allow an app; Mac: System Settings →
Network → Firewall Options).

## 3. Using it

- **Add items**: Items tab → "+ Add Item". Leave the barcode field blank to
  auto-generate one.
- **Print labels**: Print Labels tab → tick the items you want → "Print
  Label Sheet" → use your browser's print dialog (a sticker/label printer
  works too, or print on regular paper and cut).
- **Scan with a USB barcode scanner**: Scan tab → click the input box →
  scan a label. USB barcode scanners act like a keyboard, so this works
  with any standard scanner, no extra setup needed.
- **Scan with a camera**: Scan tab → "Start Camera Scanner" → allow camera
  access → point at a barcode. Works on phones/laptops with a camera.
- **Adjust stock**: from the Items or Scan tab, use "Adjust" to add or
  remove stock (e.g. receiving a shipment, selling/using an item). Every
  adjustment is logged.
- **Low stock alerts**: set a "Reorder Level" per item; anything at or below
  that shows up on the Dashboard and can be filtered on the Items tab.

## Data & backups

All data lives in `db/inventory.db` (SQLite). To back up your inventory,
just copy that file somewhere safe periodically. To move the app to a new
computer, copy the whole `inventory-app` folder including `db/inventory.db`.

## Project structure

```
inventory-app/
  server.js          Express server entry point
  db/init.js          Database schema/setup
  db/inventory.db     Your data (created on first run)
  routes/items.js      REST API for items & stock
  scripts/barcode.js   Barcode image generation
  public/              Frontend (HTML/CSS/JS)
```
