# Inventory Manager

A self-hosted inventory management web app with barcode label printing and
barcode scanning (USB scanner or phone/laptop camera). Data is stored in a
local SQLite database file - no cloud account or internet connection needed.

## Features

- **Dashboard** - total items, total units, inventory value, low-stock alerts
- **Items** - add, edit, delete, search and filter items (by name, barcode,
  category, supplier, location); stock adjustments are logged
- **Barcodes** - every item gets a barcode automatically (or set your own);
  generate a printable sheet of barcode labels to stick on products
- **Scanning** - look items up by barcode using a USB/keyboard-wedge barcode
  scanner, or your device's camera
- **Multi-device** - run it on one computer and have your staff use it from
  their own phones/laptops over your WiFi/LAN

## Live deployment

This app is deployed on Render and reachable at https://iukinventory.com

## Data & backups

All data lives in a SQLite database file. On the free hosting tier this
resets whenever the service restarts, so back up important data via the
Reports tab CSV exports periodically.

## Project structure

```
inventory-app/
  server.js             Express server entry point
  db/init.js             Database schema/setup
  routes/items.js        REST API for items & stock
  routes/auth.js         Login/session API
  routes/reports.js      Reports API
  scripts/barcode.js     Barcode image generation
  public/                 Frontend (HTML/CSS/JS)
```
