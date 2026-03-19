# Royal Caribbean DAM — Data Audit
> AEM DAM Export · `Data/royal/` · 49 assets · Audited 2026-03-17

---

## Asset Inventory

| Folder | Assets | Description |
|---|---|---|
| `ships/allure/` | 21 | Allure of the Seas — aerial, sailing, sunset, aquatheater, Naples, Galveston |
| `promotions/star-and-icon/` | 14 | Star & Icon campaign variants (multiple sizes/formats) |
| `promotions/asia/` | 5 | Asia destinations — Singapore, Hong Kong, Kuala Lumpur, Phuket, Dubai |
| `ships/anthem/` | 4 | Anthem of the Seas — aerial, New York, Norway, activity |
| `promotions/casino/` | 3 | Bankroll Blitz 2019 — desktop, mobile, background |
| `ships/grandeur/` | 2 | Grandeur of the Seas — aerial, sailing |
| **Total** | **49** | |

### Format
All assets are stored in AEM JCR structure: each asset is a **folder** named after the image file (e.g. `anthem-of-the-seas-new-york-statue-liberty.jpg/`) containing a `.content.xml` metadata file and a `_jcr_content/renditions/` folder with pre-generated thumbnails and web-sized versions.

---

## Metadata Completeness

| Field | Has Data | Missing | Notes |
|---|---|---|---|
| `dc:title` | 32/49 | **17** | |
| `dc:description` | 23/49 | **26** | 13 of these are copies of the title — effectively empty |
| `dc:creator` | 22/49 | **27** | 9 unique values, none consistent |
| Any rights data | 22/49 | **27** | Split across two fields, neither reliable |
| `xmpRights:UsageTerms` | 1/49 | **48** | Only `bumper-cars` has it |
| `xmpRights:Marked` | 2/49 | **47** | |
| `Iptc4xmpExt:LocationShown` | 18/49 | **31** | |
| `cq:tags` | 1/49 | **48** | Only `bucket-phuket` has tags |
| Channel / placement / format | 0/49 | **49** | These concepts exist only in filenames |
| Campaign / audience / segment | 0/49 | **49** | No fields exist for these at all |

**16 assets have zero descriptive metadata** — no title, description, creator, rights, location, or tags. These are entirely dependent on their filename for any context.

---

## Data Quality Issues

### 1. Title = Description (13 assets)
The `dc:description` field was copy-pasted from `dc:title` on 13 assets, making the description field meaningless. A human or AI reviewing metadata would see two identical strings and gain no additional context.

### 2. Creator Field — 9 Inconsistent Values
The same concept (Royal Caribbean brand team) appears in multiple formats:

| Value | Count | Issue |
|---|---|---|
| `[Royal Carribean]` | 6 | **Misspelling of "Caribbean"** |
| `Brand Team ` | 4 | **Trailing whitespace** |
| `[Brand Team]` | 4 | Bracket format |
| `Brand Team` | 3 | Plain format |
| `[Michel Verdure]` | 1 | Photographer name |
| `Social Media Influencer` | 1 | Vague — not a name or team |
| `[Production Team ]` | 1 | Trailing whitespace in brackets |
| `GTM` | 1 | Unexplained acronym |
| `CAP Ambassador` | 1 | Vague — not a name or team |

Filtering or reporting by creator is unreliable without normalization.

### 3. Rights — Split Fields, Neither Authoritative
Rights data is scattered across two fields with no single source of truth:

- **`xmpRights:Owner`** (15 assets): `"Royal Caribbean"` × 11, `"Royal Caribbean "` × 4 (trailing space)
- **`dc:rights`** (8 assets): `"Royal Carribean"` × 6 (misspelled), `"Royal Owned"` × 2
- **`xmpRights:UsageTerms`** (1 asset): Only `bumper-cars` specifies terms: *"Not to be reproduced without written permission"*
- **27 assets have no rights data in either field**

There is no consistent rights framework. An asset can appear rights-safe in one field while having a typo, trailing space, or nothing in another. Any downstream system consuming this data would need to reconcile both fields and normalize values before trusting them.

### 4. Model & Property Release — 7 Assets with Portuguese Placeholder
Seven assets have `ModelReleaseStatus`, `PropertyReleaseStatus`, `DigitalSourceType`, and `MinorModelAgeDisclosure` all set to:

> `"Selecione um Estado..."` *(Portuguese: "Select a State...")*

This is a UI dropdown placeholder — the fields were opened but never filled in. These assets formally have model/property release fields present but carry no meaningful data.

Affected assets:
- `allure-of-the-seas-naples-italy.jpg`
- `allure-of-the-seas-naples-italy-vertical.jpg`
- `allure-of-the-seas-sailing-sunset-centered-recrop.jpg`
- `woman-relaxing-balcony-sunset-sea-day-crop.jpg`
- `bumper-cars-woman-son-activity.jpg`
- `1040x520-2x.jpg`
- `1050x1050-V2-2x.jpg`

This is a significant compliance risk for assets that depict people (the Naples, balcony, and bumper-cars images show identifiable individuals).

### 5. No Channel or Placement Metadata
Words like `hero`, `banner`, `mobile`, `desktop` appear **only in filenames** — never in any metadata field. There is no structured field for intended use, placement, or channel. Content authors must infer format from the filename, which is unreliable (e.g. `1040x520 op2 CTA_2x.jpg` encodes dimensions and variant info in the name with no human-readable label).

### 6. Scene7 / CDN Issues

| Issue | Count |
|---|---|
| `scene7FileStatus: PublishIncomplete` | 1 (`1050x1050 op2 CTA_2x.jpg`) |
| `lastS7SyncStatus: failed` | 6 |

The 6 sync failures are all Asia promotion assets plus one Allure sunset. These assets show `PublishComplete` in one field but a sync failure in another — an inconsistency that could cause broken CDN links without any visible warning to content authors.

### 7. Duplicate Files (Identical Byte Sizes)
Two pairs of assets have exactly the same file size, strongly suggesting duplicate content under different filenames:

| File A | File B | Size |
|---|---|---|
| `allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-banner.jpg` | `allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-banner-height.jpg` | 3.4 MB |
| `allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-hero.jpg` | `allure-of-the-seas-aerial-sailing-sea-day-galveston-texas-banner-hero.jpg` | 3.3 MB |

### 8. Filename Problems
- **Spaces in filenames**: `BankrollBlitz_Desktop .jpg`, `BankrollBlitz_Mobile .jpg`, and all `op2` star-and-icon variants have spaces (including a trailing space before `.jpg`)
- **Mixed case extension**: `grandeur-of-the-seas-aerial-close-up.JPG` uses uppercase `.JPG`
- **Dimensions-as-names**: `1040x520-2x.jpg`, `1050x1050 op2 CTA_2x.jpg` — dimensions are used as the only identifier, providing no content context

---

## What Is Useful in the Data

Despite the gaps, the following is reliable and machine-readable:

| Field | Reliability | Notes |
|---|---|---|
| `dam:scene7File` / `dam:scene7Domain` | ✅ High | CDN URL constructable for all 49 assets |
| `tiff:ImageWidth` / `tiff:ImageLength` | ✅ High | Present on 47/49 |
| `dam:size` | ✅ High | File size in bytes, present on all |
| `dam:Fileformat` / `dam:MIMEtype` | ✅ High | All assets |
| `cq:parentPath` | ✅ High | DAM folder path — useful for category inference |
| `cq:lastReplicated` | ✅ High | Dates range 2024-03-10 to 2025-07-15 |
| `dam:scene7FileStatus` | ⚠ Medium | 48 PublishComplete, 1 incomplete — but see sync failures |
| `dc:title` | ⚠ Medium | 32/49 present but 13 are duplicates of description |
| `Iptc4xmpExt:LocationShown` | ⚠ Medium | 18/49 present, values appear accurate |

Thumbnails (319×319 PNG) and web-optimized images (1280px JPEG) exist on disk for all 49 assets and are immediately usable for display.

---

## Enrichment Opportunities

The gaps above define a clear GenAI enrichment agenda:

| Gap | Enrichment Approach |
|---|---|
| Missing / duplicate title & description | Vision model describes image content |
| No tags / subject classification | Vision model generates subject, mood, scene tags |
| Missing location | Infer from folder path + visual content |
| No channel/format field | Parse filename + use dimensions to classify (hero, banner, mobile, etc.) |
| Creator normalization | Standardize to canonical values via LLM |
| Rights normalization | Reconcile `xmpRights:Owner` + `dc:rights`, flag conflicts |
| Release placeholder detection | Flag assets with `"Selecione"` for human review |
| No campaign/audience/segment fields | New fields; populated by LLM based on folder context and content |

---

## File Structure Reference

```
Data/royal/
  ships/
    allure/          21 assets (incl. assets/ subfolder with 9 Galveston variants)
    anthem/          4 assets
    grandeur/        2 assets
  promotions/
    asia/            4 assets + arabian-gulf/ subfolder (1 asset)
    casino/
      bankroll-blitz-2019/   3 assets
    star-and-icon/   14 assets (multiple size/format variants of same campaign)
```

Each asset folder contains:
- `.content.xml` — all metadata
- `_jcr_content/renditions/cq5dam.thumbnail.319.319.png` — thumbnail (all 49 present)
- `_jcr_content/renditions/cq5dam.web.1280.1280.jpeg` — web image (48/49 present)

CDN base URL: `https://assets.dm.rccl.com/is/image/RoyalCaribbeanCruises/<scene7Name>`
