# FilmFlow Inventory — Google Sheets Template & Sync Guide

> This guide outlines the standard spreadsheet column structures required for automated 2-way synchronization with FilmFlow Inventory.

---

## 1. Google Service Account Permission Setup

Before syncing, share your Google Spreadsheet with the FilmFlow Sync Service Account:
```
Email: filmflow-sheet-sync-bot@filmflow-inventory-sync.iam.gserviceaccount.com
Role:  Viewer (or Editor if 2-way writeback is enabled)
```

---

## 2. Department Spreadsheet Specifications

### 🎬 A. Equipment / Camera Department
Each tab represents a category or equipment group (e.g. `Cameras`, `Lenses`, `Lighting`, `Grip`, `Sound`).

| Column | Header Name | Format / Example | Description |
| :--- | :--- | :--- | :--- |
| **A** | `Code` / `SKU` | `CAM-001`, `LEN-012` | Unique identifier for product label & QR code. |
| **B** | `Title` / `Item Name` | `Sony FX6 Full-Frame Camera` | Primary item name (Thai / English). |
| **C** | `Category` | `Camera Body`, `Prime Lens` | Auto-assigned from tab title or column. |
| **D** | `Location` | `Shelf A-1`, `Main Pelican #4` | Physical warehouse storage location. |
| **E** | `Status` | `In Stock`, `Checked Out`, `Maintenance` | Current inventory availability. |
| **F** | `Image` / `Drive URL` | `https://drive.google.com/file/d/.../view` | Direct Google Drive photo link (auto-extracted to thumbnail). |
| **G** | `Serial Number` | `S/N: 4892019` | Hardware serial number. |
| **H** | `Remark` / `Notes` | `Includes top handle and 2x 160GB CFexpress` | Accessories or maintenance notes. |

---

### 🎨 B. Art Department
Categorized by sets, scenes, or prop families (e.g. `Furniture`, `Set Dressing`, `Hero Props`, `Signage`).

| Column | Header Name | Format / Example | Description |
| :--- | :--- | :--- | :--- |
| **A** | `SKU` | `ART-PROP-001` | Unique prop code. |
| **B** | `Name` | `Vintage Rotary Telephone (Black)` | Prop description. |
| **C** | `Scene / Set` | `Scene 14 - Detective Office` | Film scene reference. |
| **D** | `Storage Bin` | `Box #12 - Office Props` | Pack box or staging area. |
| **E** | `Photo` | `https://drive.google.com/file/d/...` | Prop reference photo. |
| **F** | `Quantity` | `1`, `4` | Stock quantity available. |

---

### 👗 C. Wardrobe (WD) Department
Categorized by characters, cast members, or costume racks (e.g. `Lead Actor`, `Supporting Cast`, `Extras Rack`).

| Column | Header Name | Format / Example | Description |
| :--- | :--- | :--- | :--- |
| **A** | `SKU` | `WD-HERO-01` | Costume identifier. |
| **B** | `Character` / `Role` | `Alex (Day 1 - Office Suit)` | Character name and scene continuity. |
| **C** | `Size` | `M / 38R` | Garment sizing. |
| **D** | `Rack Location` | `WD Rack #2` | Physical rack location. |
| **E** | `Photo` | `https://drive.google.com/file/d/...` | Fitting & continuity photograph. |
| **F** | `Status` | `Cleaned`, `On Set`, `In Laundry` | Costume condition and availability. |

---

## 3. Image URL Format Guidelines

FilmFlow Inventory automatically extracts direct high-resolution thumbnails from any standard Google Drive sharing URL:
- ✅ `https://drive.google.com/file/d/1AbC-xyz123_456789/view?usp=sharing`
- ✅ `https://drive.google.com/open?id=1AbC-xyz123_456789`
- ✅ `1AbC-xyz123_456789abcdefgh` (Bare File ID)

> **Important**: Ensure the Google Drive folder or image files have **"Anyone with the link can view"** enabled.
