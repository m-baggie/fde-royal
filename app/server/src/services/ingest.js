'use strict';

const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

/**
 * Strip JCR type wrappers from attribute values.
 * '{Long}1920' → 1920 (integer)
 * '{Boolean}true' → 'true'
 * '{Date}2021-...' → '2021-...'
 * '{Decimal}0.20' → '0.20'
 */
function stripJcrType(val) {
  if (typeof val !== 'string') return val;
  const match = val.match(/^\{(Long|Boolean|Date|Decimal)\}(.+)$/);
  if (!match) return val;
  if (match[1] === 'Long') return parseInt(match[2], 10);
  return match[2];
}

/** Normalize a raw XML attribute value: strip JCR wrapper, trim, return null if empty. */
function norm(val) {
  if (val === undefined || val === null) return null;
  const str = String(val);
  const stripped = stripJcrType(str);
  if (typeof stripped === 'number') return stripped;
  const trimmed = stripped.trim();
  return trimmed === '' ? null : trimmed;
}

/** Normalize creator field to canonical form. */
const CREATOR_NORMALIZED_VALUES = new Set([
  '[Royal Carribean]',
  '[Brand Team]',
  'Brand Team',
  'Brand Team ',
  '[Production Team]',
  '[Production Team ]',
]);

function normalizeCreator(creator) {
  if (!creator) return null;
  const trimmed = creator.trim();
  if (CREATOR_NORMALIZED_VALUES.has(creator.trim()) || CREATOR_NORMALIZED_VALUES.has(creator)) {
    return 'Royal Caribbean Brand Team';
  }
  // Match trimmed version too (handles variants like 'Brand Team ')
  if (trimmed === 'Brand Team') return 'Royal Caribbean Brand Team';
  return null;
}

/**
 * Reconcile rights status from xmpRights:Owner and dc:rights.
 * - contains 'royal caribbean' (case-insensitive, trimmed) → 'owned'
 * - rights data present but doesn't match → 'unclear'
 * - no rights data → 'none'
 */
function reconcileRights(owner, dcRights) {
  const ownerStr = owner ? owner.trim().toLowerCase() : '';
  const rightsStr = dcRights ? dcRights.trim().toLowerCase() : '';
  if (ownerStr.includes('royal caribbean') || rightsStr.includes('royal caribbean')) {
    return 'owned';
  }
  if (ownerStr || rightsStr) {
    return 'unclear';
  }
  return 'none';
}

/** Infer channel from filename and dimensions. */
function inferChannel(filename, width, height) {
  const name = filename.toLowerCase();
  if (name.includes('hero')) return 'hero';
  if (name.includes('banner')) return 'banner';
  if (name.includes('mobile')) return 'mobile';
  if (name.includes('desktop')) return 'desktop';
  if (width && height) {
    if (height > width) return 'mobile';
    if (width > height) return 'desktop';
    return 'square';
  }
  return null;
}

/** Infer format from dimensions. */
function inferFormat(width, height) {
  if (!width || !height) return null;
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'square';
}

/**
 * Recursively walk dir, collecting paths to .content.xml files where:
 * - the parent folder name ends in .jpg/.jpeg/.png/.JPG (case-insensitive)
 * - the full path does NOT contain '_jcr_content'
 */
function findAssetXmlFiles(dir) {
  const results = [];
  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === '.content.xml') {
        if (fullPath.includes('_jcr_content')) continue;
        const parentName = path.basename(path.dirname(fullPath));
        if (/\.(jpg|jpeg|png)$/i.test(parentName)) {
          results.push(fullPath);
        }
      }
    }
  }
  walk(dir);
  return results;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseAttributeValue: false,
});

/** Parse a .content.xml file, returning { content, metadata } attribute maps. */
function parseAssetXml(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const parsed = xmlParser.parse(xml);
  const root = parsed['jcr:root'];
  if (!root) throw new Error('No jcr:root element');
  const content = root['jcr:content'];
  if (!content) throw new Error('No jcr:content element');
  const metadata = content['metadata'] || {};
  return { content, metadata };
}

/**
 * Ingest all assets from dataDir into the SQLite database.
 * Relative dataDir is resolved relative to process.cwd().
 * Returns the number of rows inserted.
 */
function ingestAssets(db, dataDir) {
  const resolvedDir = path.isAbsolute(dataDir)
    ? dataDir
    : path.resolve(process.cwd(), dataDir);

  const xmlFiles = findAssetXmlFiles(resolvedDir);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO assets (
      id, filename, filepath, thumbnail_path, web_image_path,
      category, subcategory, subsubcategory,
      original_title, original_description, original_creator,
      original_rights_owner, original_dc_rights, original_usage_terms,
      original_location, original_tags,
      enriched_creator_normalized, enriched_rights_status,
      enriched_channel, enriched_format,
      width, height, file_size, file_format, mime_type,
      scene7_file, scene7_domain, scene7_status,
      s7_sync_error, needs_rights_review, has_release_placeholder,
      dam_last_modified, dam_last_replicated
    ) VALUES (
      @id, @filename, @filepath, @thumbnail_path, @web_image_path,
      @category, @subcategory, @subsubcategory,
      @original_title, @original_description, @original_creator,
      @original_rights_owner, @original_dc_rights, @original_usage_terms,
      @original_location, @original_tags,
      @enriched_creator_normalized, @enriched_rights_status,
      @enriched_channel, @enriched_format,
      @width, @height, @file_size, @file_format, @mime_type,
      @scene7_file, @scene7_domain, @scene7_status,
      @s7_sync_error, @needs_rights_review, @has_release_placeholder,
      @dam_last_modified, @dam_last_replicated
    )
  `);

  let count = 0;

  for (const xmlPath of xmlFiles) {
    try {
      const { content, metadata } = parseAssetXml(xmlPath);

      const assetDir = path.dirname(xmlPath);
      const id = path.basename(assetDir);
      const filename = id;

      // Relative path from dataDir to the asset folder
      const relPath = path.relative(resolvedDir, assetDir);

      // Category/subcategory/subsubcategory from path segments (excluding last = asset folder)
      const segments = relPath.split(path.sep).filter(Boolean);
      const pathSegments = segments.slice(0, -1);
      const category = pathSegments[0] || null;
      const subcategory = pathSegments[1] || null;
      const subsubcategory = pathSegments[2] || null;

      // Metadata fields
      const originalTitle = norm(metadata['@_dc:title']);
      const originalDescription = norm(metadata['@_dc:description']);
      const originalCreator = norm(metadata['@_dc:creator']);
      const originalDcRights = norm(metadata['@_dc:rights']);
      const originalRightsOwner = norm(metadata['@_xmpRights:Owner']);
      const originalUsageTerms = norm(metadata['@_xmpRights:UsageTerms']);
      const originalLocation = norm(metadata['@_Iptc4xmpExt:LocationShown']);
      const originalTags = norm(metadata['@_cq:tags']);

      // Dimensions — strip JCR Long wrapper
      const widthRaw = metadata['@_tiff:ImageWidth'];
      const heightRaw = metadata['@_tiff:ImageLength'];
      const width = widthRaw != null ? (() => { const v = stripJcrType(String(widthRaw)); return typeof v === 'number' ? v : null; })() : null;
      const height = heightRaw != null ? (() => { const v = stripJcrType(String(heightRaw)); return typeof v === 'number' ? v : null; })() : null;

      const fileSizeRaw = metadata['@_dam:size'];
      const fileSize = fileSizeRaw != null ? (() => { const v = stripJcrType(String(fileSizeRaw)); return typeof v === 'number' ? v : null; })() : null;

      const fileFormat = norm(metadata['@_dam:Fileformat']);
      const mimeType = norm(metadata['@_dam:MIMEtype']);
      const scene7File = norm(metadata['@_dam:scene7File']);
      const scene7Domain = norm(metadata['@_dam:scene7Domain']);
      const scene7Status = norm(metadata['@_dam:scene7FileStatus']);

      // dam:lastS7SyncStatus lives on jcr:content, not metadata
      const lastS7SyncStatus = content['@_dam:lastS7SyncStatus'];
      const s7SyncError = typeof lastS7SyncStatus === 'string' && lastS7SyncStatus.startsWith('failed') ? 1 : 0;

      // Timestamps from jcr:content
      const damLastModified = norm(content['@_jcr:lastModified']);
      const damLastReplicated = norm(content['@_cq:lastReplicated']);

      // Deterministic enrichments
      const enrichedCreatorNormalized = normalizeCreator(originalCreator);
      const enrichedRightsStatus = reconcileRights(originalRightsOwner, originalDcRights);
      const enrichedChannel = inferChannel(filename, width, height);
      const enrichedFormat = inferFormat(width, height);

      // Release placeholder: any string attribute value containing 'Selecione'
      const hasReleasePlaceholder = Object.values(metadata).some(
        v => typeof v === 'string' && v.includes('Selecione')
      ) ? 1 : 0;

      // Rendition paths (relative to dataDir if they exist on disk)
      const thumbAbs = path.join(assetDir, '_jcr_content', 'renditions', 'cq5dam.thumbnail.319.319.png');
      const webAbs = path.join(assetDir, '_jcr_content', 'renditions', 'cq5dam.web.1280.1280.jpeg');
      const thumbnailPath = fs.existsSync(thumbAbs) ? path.relative(resolvedDir, thumbAbs) : null;
      const webImagePath = fs.existsSync(webAbs) ? path.relative(resolvedDir, webAbs) : null;

      insert.run({
        id,
        filename,
        filepath: relPath,
        thumbnail_path: thumbnailPath,
        web_image_path: webImagePath,
        category,
        subcategory,
        subsubcategory,
        original_title: originalTitle,
        original_description: originalDescription,
        original_creator: originalCreator,
        original_rights_owner: originalRightsOwner,
        original_dc_rights: originalDcRights,
        original_usage_terms: originalUsageTerms,
        original_location: originalLocation,
        original_tags: originalTags,
        enriched_creator_normalized: enrichedCreatorNormalized,
        enriched_rights_status: enrichedRightsStatus,
        enriched_channel: enrichedChannel,
        enriched_format: enrichedFormat,
        width,
        height,
        file_size: fileSize,
        file_format: fileFormat,
        mime_type: mimeType,
        scene7_file: scene7File,
        scene7_domain: scene7Domain,
        scene7_status: scene7Status,
        s7_sync_error: s7SyncError,
        needs_rights_review: 0,
        has_release_placeholder: hasReleasePlaceholder,
        dam_last_modified: damLastModified,
        dam_last_replicated: damLastReplicated,
      });

      count++;
    } catch (err) {
      console.warn(`Skipping ${xmlPath}: ${err.message}`);
    }
  }

  return count;
}

module.exports = { ingestAssets };
