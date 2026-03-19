# Royal Caribbean — Session Summary
**Project:** Intelligent Asset Discovery (GenAI MVP)
**Last updated:** 2026-03-06

---

## Goal

Build a GenAI-powered asset enrichment and semantic search MVP over Royal Caribbean's AEM DAM. Target users: Web AEM Content Authors and Campaign Email Marketing team. Tech stack: AWS Bedrock + OpenAI API.

---

## Key File Architecture

```
Royal Caribbean/
  Royal Caribbean Case Study.pdf     # Client brief (RC case study = pages 1-4 only)
  docs/
    session-summary.md               # This file
  Data/
    royal/
      ships/
        allure/                      # ~18 assets (aerial, sailing, sunset, aquatheater, Europe, Naples)
        anthem/                      # 4 assets (aerial, NY/Statue of Liberty, Norway, bumper cars)
        grandeur/                    # 2 assets (aerial close-up, sailing)
      promotions/
        asia/                        # 4 assets (Singapore, HK, KL, Phuket)
          arabian-gulf/              # 1 asset (Dubai skyline)
        casino/
          bankroll-blitz-2019/       # 3 assets (desktop, mobile, background)
        star-and-icon/               # 12 assets (various pixel-dimension named variants)
```

**Ignorable paths:** `_jcr_content/renditions/` subfolders (thumbnail/web renditions, not originals).
**Ignorable files:** Folder-level `.content.xml` files (no asset metadata).

Each image asset has a `.content.xml` sidecar in JCR XML format — this is the metadata source.

**Total assets:** 49 (48 JPG + 1 PNG)

---

## Data: AEM JCR XML Metadata Schema

Key XML namespaces in each `.content.xml`:

| Namespace | Contents |
|-----------|----------|
| `dc:` | title, description, creator, rights, format |
| `xmpRights:` | Owner, UsageTerms, Marked, WebStatement |
| `dam:` | file size, MIME type, Scene7 CDN path/ID/status, sync timestamps |
| `tiff:` | ImageWidth, ImageLength (pixel dimensions) |
| `exif:` | Camera settings, date taken (only 2 assets have this) |
| `Iptc4xmpExt:` | LocationShown (ship or destination name) |
| `cq:` | DAM path, last replicated date, publish status, tags |
| `crs:` | Lightroom/Camera Raw settings (some assets) |
| `plus:` | ModelReleaseStatus, PropertyReleaseStatus |

**Scene7 CDN:**
- Domain: `https://assets.dm.rccl.com/`
- File pattern: `RoyalCaribbeanCruises/<asset-name>`
- CompanyID: `c|239426`

---

## Metadata Quality Findings

### Completeness

| Field | Missing |
|-------|---------|
| `dc:title` | 17/49 |
| `dc:description` | 27/49 |
| `dc:creator` | 27/49 |
| Any rights info | 27/49 |
| `xmpRights:UsageTerms` | 48/49 (only bumper-cars has it) |
| `cq:tags` | 48/49 (only Phuket has any) |
| Location | 31/49 |
| Title == Description (circular, useless) | 13/49 |
| EXIF data | only 2/49 have it |

### Inconsistency Patterns

1. **Creator format chaos** — 9 unique values: `"[Brand Team]"`, `"Brand Team"`, `"Brand Team "` (trailing space), `"Royal Carribean"` (misspelled), `"Social Media Influencer"`, `"CAP Ambassador"`, `"GTM"`

2. **Rights split across fields** — `dc:rights` ("Royal Owned", "Royal Carribean" [typo]) vs `xmpRights:Owner` ("Royal Caribbean", "Royal Caribbean " [trailing space]) — no authoritative single field; 48/49 have no UsageTerms

3. **Model/Property release placeholders** — 7 assets have `"Selecione um Estado..."` (Portuguese UI default = never filled in)

4. **Silent Scene7 sync failures** — 6 assets show `s7_status: PublishComplete` but have `lastS7SyncStatus: failed` hidden in JCR content (all Asia promos + 1 allure asset)

5. **One asset PublishIncomplete** — `1050x1050 op2 CTA_2x.jpg` (star-and-icon)

6. **Probable duplicate files** — 2 pairs with identical byte sizes and dimensions:
   - Galveston `banner` vs `banner-height`
   - `hero` vs `banner-hero`

7. **No channel/format metadata** — "hero" and "banner" only appear in filenames, never in metadata fields

8. **No audience, segment, or campaign fields** — zero assets have any of these

9. **Filename issues** — spaces (`"BankrollBlitz_Desktop .jpg"`), mixed `.JPG`/`.jpg` casing, dimensions-as-filenames for star-and-icon variants

---

## Prioritized Client Follow-Up Questions

1. **Rights authority** — Which field is the authoritative rights source: `dc:rights` or `xmpRights:Owner`? Should GenAI be allowed to enrich rights fields, or are they governance-only?

2. **Usage terms** — 48/49 assets have no UsageTerms. Is this intentional (handled outside DAM), or a gap to fill? What are the actual permitted uses (web, email, social, paid)?

3. **Model/Property release** — 7 assets have placeholder release status. What's the correct workflow — manual review or a lookup integration?

4. **Creator taxonomy** — Should "creator" mean the photographer, the team, or the content source? Can we get a controlled vocabulary?

5. **Tagging taxonomy** — No standardized tags exist. Should GenAI propose tags, or does RC have a controlled tag library in AEM to align to?

6. **Scene7 sync failures** — 6 assets show hidden sync errors despite appearing published. Does the team know? Is there a remediation process?

7. **Channel/format metadata** — No metadata indicates whether an asset is a hero, banner, thumbnail, etc. Should GenAI infer this from filename/dimensions, or will RC define a schema?

8. **Duplicate assets** — 2 probable duplicate pairs exist. What's the dedup policy? Are variants intentional for different contexts?

---

## AI Limitations for This Problem

1. **Hallucinated metadata** — LLMs will fabricate plausible-sounding titles, descriptions, and location tags. Every enriched field needs a confidence score and human review gate.

2. **Rights cannot be inferred** — AI cannot determine who owns an asset, what releases were signed, or what uses are permitted. Rights enrichment requires a source-of-truth lookup, not generation.

3. **Image understanding has limits** — Vision models misidentify ships, confuse ports, and fail on low-res or cropped thumbnails. Ship-specific and destination-specific accuracy needs validation.

4. **Semantic search always returns something** — There is no "no match" signal. Bad queries return bad results confidently. A relevance threshold and "no results" UX path must be designed.

5. **Garbage in, garbage out** — 13 assets have title == description (circular). Enriching from circular metadata amplifies the error. Source quality gates are required before enrichment.

6. **No memory of editorial decisions** — Each enrichment run is stateless. If a content author manually corrects a GenAI suggestion, that correction won't persist unless explicitly stored and fed back into the pipeline.

7. **Dual-status confusion** — The silent Scene7 sync failures (PublishComplete + hidden failed status) mean AI systems reading DAM state will classify broken assets as healthy.

---

## Assumptions Made

- The `Data/royal/` directory is a real AEM DAM export (not synthetic mock data as the case study implied might be needed)
- `_jcr_content/renditions/` folders contain only AEM-generated thumbnails — not original binaries
- Folder-level `.content.xml` files (without a parent image asset name) are JCR folder nodes, not asset records
- Byte-size equality is used as a proxy for duplicate detection; actual pixel-level dedup not performed

---

## Open Questions

- Will RC provide access to their AEM tag namespace/taxonomy for controlled vocabulary alignment?
- Is the OpenAI API key scoped for production use, or only for the MVP sandbox?
- Are there additional asset folders beyond `ships/` and `promotions/` (e.g., destinations, onboard experiences)?
- What is the expected query interface — freeform search bar, faceted filters, or both?
- Is there a minimum confidence threshold below which enriched metadata should not be published automatically?
