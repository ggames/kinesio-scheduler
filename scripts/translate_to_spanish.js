// scripts/translate_to_spanish.js
const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// Mapping definitions – adjust/extend as needed
// -----------------------------------------------------------------------------
const folderMap = {
  appointments: 'es-citas',
  'health-insurances': 'es-aseguradoras-salud',
  patients: 'es-pacientes',
  professionals: 'es-profesionales',
  resources: 'es-recursos',
  treatments: 'es-tratamientos',
  users: 'es-usuarios',
};

const filePartMap = {
  controller: 'controlador',
  service: 'servicio',
  entity: 'entidad',
  module: 'modulo',
  repository: 'repositorio',
};

const identifierMap = {
  Patient: 'Paciente',
  CreatePatientDto: 'CrearPacienteDto',
  UpdatePatientDto: 'ActualizarPacienteDto',
  Clinic: 'Clinica',
  Appointment: 'Cita',
  CreateAppointmentDto: 'CrearCitaDto',
  UpdateAppointmentDto: 'ActualizarCitaDto',
};

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------
/** Translate a filesystem path according to the maps above.
 * Preserves absolute‑ness (leading '/'). */
function translatePath(originalPath) {
  const isAbs = path.isAbsolute(originalPath);
  const parts = originalPath.split(path.sep).filter(Boolean);
  const translated = parts.map(p => {
    // Folder translation
    if (folderMap[p]) return folderMap[p];
    // File name translation (keep extension)
    const ext = path.extname(p);
    const base = path.basename(p, ext);
    let newBase = base;
    Object.entries(filePartMap).forEach(([eng, esp]) => {
      newBase = newBase.replace(new RegExp(eng, 'g'), esp);
    });
    // Prefix "es-" for TypeScript source files
    if (ext === '.ts' && !newBase.startsWith('es-')) newBase = 'es-' + newBase;
    return newBase + ext;
  });
  const joined = path.join(...translated);
  return isAbs ? '/' + joined : joined;
}

/** Replace identifiers inside file content using the identifierMap. */
function translateIdentifiers(content) {
  let result = content;
  Object.entries(identifierMap).forEach(([eng, esp]) => {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    result = result.replace(regex, esp);
  });
  return result;
}

/** Update relative import paths based on the old→new path map. */
function updateImportPaths(filePath, content, oldToNew) {
  return content.replace(/from\s+['"]([^'\"]+)['"]/g, (match, importPath) => {
    if (!importPath.startsWith('.')) return match; // external module – leave untouched
    const resolved = path.resolve(path.dirname(filePath), importPath + '.ts'); // assume .ts extension
    const newAbs = oldToNew.get(resolved);
    if (!newAbs) return match; // could not resolve – keep original
    let newRel = path.relative(path.dirname(filePath), newAbs);
    newRel = newRel.startsWith('..') ? newRel : './' + newRel;
    // Drop .ts extension for import statements
    newRel = newRel.replace(/\\.ts$/i, '');
    return `from '${newRel}'`;
  });
}

/** Recursively collect all *.ts files under a root directory. */
function collectTsFiles(root) {
  const files = [];
  function recurse(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
    }
  }
  recurse(root);
  return files;
}

/** Remove empty directories left after moving files. */
function cleanupEmptyDirs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanupEmptyDirs(child);
      if (fs.readdirSync(child).length === 0) fs.rmdirSync(child);
    }
  }
}

/** Main translation workflow (in‑place modification). */
function translateProject(srcRoot) {
  const tsFiles = collectTsFiles(srcRoot);

  // Map old absolute path -> new absolute path
  const oldToNew = new Map();
  tsFiles.forEach(oldPath => {
    const rel = path.relative(srcRoot, oldPath);
    const newRel = translatePath(rel);
    const newAbs = path.join(srcRoot, newRel);
    oldToNew.set(oldPath, newAbs);
  });

  // Transform content (identifiers + imports) in memory
  const transformed = new Map();
  tsFiles.forEach(oldPath => {
    let content = fs.readFileSync(oldPath, 'utf8');
    content = translateIdentifiers(content);
    content = updateImportPaths(oldPath, content, oldToNew);
    transformed.set(oldPath, content);
  });

  // Write new files and delete old ones
  for (const [oldPath, newPath] of oldToNew.entries()) {
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(newPath, transformed.get(oldPath), 'utf8');
    if (newPath !== oldPath) fs.unlinkSync(oldPath);
  }

  // Clean up empty directories left behind
  cleanupEmptyDirs(srcRoot);
}

const srcRoot = path.resolve(__dirname, '..', 'src');
console.log('🔄 Starting translation of Kinesiology Scheduler project...');
translateProject(srcRoot);
console.log('✅ Translation finished.');

const fs = require('fs');
const path = require('path');

// -----------------------------------------------------------------------------
// Mapping definitions – adjust/extend as needed
// -----------------------------------------------------------------------------
const folderMap = {
  appointments: 'es-citas',
  'health-insurances': 'es-aseguradoras-salud',
  patients: 'es-pacientes',
  professionals: 'es-profesionales',
  resources: 'es-recursos',
  treatments: 'es-tratamientos',
  users: 'es-usuarios',
};

const filePartMap = {
  controller: 'controlador',
  service: 'servicio',
  entity: 'entidad',
  module: 'modulo',
  repository: 'repositorio',
};

const identifierMap = {
  Patient: 'Paciente',
  CreatePatientDto: 'CrearPacienteDto',
  UpdatePatientDto: 'ActualizarPacienteDto',
  Clinic: 'Clinica',
  Appointment: 'Cita',
  CreateAppointmentDto: 'CrearCitaDto',
  UpdateAppointmentDto: 'ActualizarCitaDto',
};

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------
/** Translate a filesystem path according to the maps above.
 * Preserves absolute‑ness (leading '/'). */
function translatePath(originalPath) {
  const isAbs = path.isAbsolute(originalPath);
  const parts = originalPath.split(path.sep).filter(Boolean);
  const translated = parts.map(p => {
    // Folder translation
    if (folderMap[p]) return folderMap[p];
    // File name translation (keep extension)
    const ext = path.extname(p);
    const base = path.basename(p, ext);
    let newBase = base;
    Object.entries(filePartMap).forEach(([eng, esp]) => {
      newBase = newBase.replace(new RegExp(eng, 'g'), esp);
    });
    // Prefix "es-" for TypeScript source files
    if (ext === '.ts' && !newBase.startsWith('es-')) newBase = 'es-' + newBase;
    return newBase + ext;
  });
  const joined = path.join(...translated);
  return isAbs ? '/' + joined : joined;
}

/** Replace identifiers inside file content using the identifierMap. */
function translateIdentifiers(content) {
  let result = content;
  Object.entries(identifierMap).forEach(([eng, esp]) => {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    result = result.replace(regex, esp);
  });
  return result;
}

/** Update relative import paths based on the old→new path map. */
function updateImportPaths(filePath, content, oldToNew) {
  return content.replace(/from\s+['"]([^'\"]+)['"]/g, (match, importPath) => {
    if (!importPath.startsWith('.')) return match; // external module – leave untouched
    const resolved = path.resolve(path.dirname(filePath), importPath + '.ts'); // assume .ts extension
    const newAbs = oldToNew.get(resolved);
    if (!newAbs) return match; // could not resolve – keep original
    let newRel = path.relative(path.dirname(filePath), newAbs);
    newRel = newRel.startsWith('..') ? newRel : './' + newRel;
    // Drop .ts extension for import statements (Node/TS style)
    newRel = newRel.replace(/\.ts$/i, '');
    return `from '${newRel}'`;
  });
}

/** Recursively collect all *.ts files under a root directory. */
function collectTsFiles(root) {
  const files = [];
  function recurse(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
    }
  }
  recurse(root);
  return files;
}

/** Remove empty directories left behind after moving files. */
function cleanupEmptyDirs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanupEmptyDirs(child);
      if (fs.readdirSync(child).length === 0) fs.rmdirSync(child);
    }
  }
}

// -----------------------------------------------------------------------------
// Main translation workflow (in‑place modification)
// -----------------------------------------------------------------------------
function translateProject(srcRoot) {
  const tsFiles = collectTsFiles(srcRoot);

  // Build map: old absolute path -> new absolute path
  const oldToNew = new Map();
  tsFiles.forEach(oldPath => {
    const rel = path.relative(srcRoot, oldPath);
    const newRel = translatePath(rel);
    const newAbs = path.join(srcRoot, newRel);
    oldToNew.set(oldPath, newAbs);
  });

  // First pass: transform content (identifiers + imports) in memory
  const transformed = new Map();
  tsFiles.forEach(oldPath => {
    let content = fs.readFileSync(oldPath, 'utf8');
    content = translateIdentifiers(content);
    content = updateImportPaths(oldPath, content, oldToNew);
    transformed.set(oldPath, content);
  });

  // Write transformed content to new locations and delete old files
  for (const [oldPath, newPath] of oldToNew.entries()) {
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(newPath, transformed.get(oldPath), 'utf8');
    if (newPath !== oldPath) fs.unlinkSync(oldPath);
  }

  // Clean up any empty directories that may remain from the old layout
  cleanupEmptyDirs(srcRoot);
}

const srcRoot = path.resolve(__dirname, '..', 'src');
console.log('🔄 Starting translation of Kinesiology Scheduler project...');
translateProject(srcRoot);
console.log('✅ Translation finished.');

const fs = require('fs');
const path = require('path');

// Folder translation map (English → Spanish with es- prefix)
const folderMap = {
  appointments: 'es-citas',
  'health-insurances': 'es-aseguradoras-salud',
  patients: 'es-pacientes',
  professionals: 'es-profesionales',
  resources: 'es-recursos',
  treatments: 'es-tratamientos',
  users: 'es-usuarios',
};

// File name part translation (e.g., controller → controlador)
const filePartMap = {
  controller: 'controlador',
  service: 'servicio',
  entity: 'entidad',
  module: 'modulo',
  repository: 'repositorio',
};

// Identifier translation (class / interface / variable names)
const identifierMap = {
  Patient: 'Paciente',
  CreatePatientDto: 'CrearPacienteDto',
  UpdatePatientDto: 'ActualizarPacienteDto',
  Clinic: 'Clinica',
  Appointment: 'Cita',
  CreateAppointmentDto: 'CrearCitaDto',
  UpdateAppointmentDto: 'ActualizarCitaDto',
};

/** Translate a filesystem path according to the maps above. */
function translatePath(originalPath) {
  const isAbs = path.isAbsolute(originalPath);
  const parts = originalPath.split(path.sep).filter(Boolean);
  const translated = parts.map(p => {
    if (folderMap[p]) return folderMap[p];
    const ext = path.extname(p);
    const base = path.basename(p, ext);
    let newBase = base;
    Object.entries(filePartMap).forEach(([eng, esp]) => {
      newBase = newBase.replace(new RegExp(eng, 'g'), esp);
    });
    if (ext === '.ts' && !newBase.startsWith('es-')) newBase = 'es-' + newBase;
    return newBase + ext;
  });
  const joined = path.join(...translated);
  return isAbs ? '/' + joined : joined;
}

/** Translate identifiers inside file content */
function translateIdentifiers(content) {
  let result = content;
  Object.entries(identifierMap).forEach(([eng, esp]) => {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    result = result.replace(regex, esp);
  });
  return result;
}

/** Update relative import paths in a file */
function updateImportPaths(filePath, content, oldToNew) {
  return content.replace(/from\s+['"]([^'\"]+)['"]/g, (match, importPath) => {
    if (!importPath.startsWith('.')) return match; // external module
    const resolved = path.resolve(path.dirname(filePath), importPath + '.ts');
    const newAbs = oldToNew.get(resolved);
    if (!newAbs) return match;
    let newRel = path.relative(path.dirname(filePath), newAbs);
    newRel = newRel.startsWith('..') ? newRel : './' + newRel;
    // drop .ts extension for import statement
    newRel = newRel.replace(/\.ts$/i, '');
    return `from '${newRel}'`;
  });
}

/** Recursively collect all .ts files under a directory */
function collectTsFiles(root) {
  const files = [];
  function recurse(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
    }
  }
  recurse(root);
  return files;
}

/** Main translation workflow */
function translateProject(srcRoot) {
  const tsFiles = collectTsFiles(srcRoot);
  // Map old absolute file path → new absolute file path
  const oldToNew = new Map();
  tsFiles.forEach(oldPath => {
    const rel = path.relative(srcRoot, oldPath);
    const newRel = translatePath(rel);
    const newAbs = path.join(srcRoot, newRel);
    oldToNew.set(oldPath, newAbs);
  });

  // Translate identifiers and imports in memory
  const newContents = new Map();
  tsFiles.forEach(oldPath => {
    let content = fs.readFileSync(oldPath, 'utf8');
    content = translateIdentifiers(content);
    content = updateImportPaths(oldPath, content, oldToNew);
    newContents.set(oldPath, content);
  });

  // Write new files and delete old ones
  for (const [oldPath, newPath] of oldToNew.entries()) {
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(newPath, newContents.get(oldPath), 'utf8');
    fs.unlinkSync(oldPath);
  }

  // Remove empty directories left behind
  function cleanup(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        cleanup(child);
        if (fs.readdirSync(child).length === 0) fs.rmdirSync(child);
      }
    }
  }
  cleanup(srcRoot);
}

const srcRoot = path.resolve(__dirname, '..', 'src');
console.log('Starting translation of Kinesiology Scheduler project...');
translateProject(srcRoot);
console.log('Translation finished.');

const fs = require('fs');
const path = require('path');

// Folder translation map (English → Spanish with es- prefix)
const folderMap = {
  'appointments': 'es-citas',
  'health-insurances': 'es-aseguradoras-salud',
  'patients': 'es-pacientes',
  'professionals': 'es-profesionales',
  'resources': 'es-recursos',
  'treatments': 'es-tratamientos',
  'users': 'es-usuarios',
};

// File name part translation (e.g., controller → controlador)
const filePartMap = {
  'controller': 'controlador',
  'service': 'servicio',
  'entity': 'entidad',
  'module': 'modulo',
  'repository': 'repositorio',
};

// Identifier translation (class / interface / variable names)
const identifierMap = {
  Patient: 'Paciente',
  CreatePatientDto: 'CrearPacienteDto',
  UpdatePatientDto: 'ActualizarPacienteDto',
  Clinic: 'Clinica',
  Appointment: 'Cita',
  CreateAppointmentDto: 'CrearCitaDto',
  UpdateAppointmentDto: 'ActualizarCitaDto',
};

/**
 * Translate a filesystem path according to the maps above.
 * Returns a new absolute or relative path (preserves leading `/` if present).
 */
function translatePath(originalPath) {
  const isAbs = path.isAbsolute(originalPath);
  const parts = originalPath.split(path.sep).filter(Boolean);
  const translated = parts.map(p => {
    // Folder translation
    if (folderMap[p]) return folderMap[p];
    // File name translation (keep extension)
    const ext = path.extname(p);
    const base = path.basename(p, ext);
    let newBase = base;
    Object.entries(filePartMap).forEach(([eng, esp]) => {
      newBase = newBase.replace(new RegExp(eng, 'g'), esp);
    });
    // Prefix es- for TypeScript source files
    if (ext === '.ts' && !newBase.startsWith('es-')) {
      newBase = 'es-' + newBase;
    }
    return newBase + ext;
  });
  const joined = path.join(...translated);
  return isAbs ? '/' + joined : joined;
}

/** Translate identifiers inside file content */
function translateIdentifiers(content) {
  let result = content;
  Object.entries(identifierMap).forEach(([eng, esp]) => {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    result = result.replace(regex, esp);
  });
  return result;
}

/**
 * Update import paths inside a file.
 * The project uses relative imports without the .ts extension.
 */
function updateImportPaths(filePath, content, oldToNew) {
  return content.replace(/from\s+['"]([^'\"]+)['"]/g, (match, importPath) => {
    if (!importPath.startsWith('.')) return match; // external package, leave untouched
    const resolved = path.resolve(path.dirname(filePath), importPath + '.ts'); // assume .ts file exists
    const newAbs = oldToNew.get(resolved);
    if (!newAbs) return match; // could not resolve, keep original
    const newRel = path.relative(path.dirname(filePath), newAbs);
    const final = newRel.startsWith('..') ? newRel : './' + newRel;
    // Remove .ts extension for import statement
    const cleaned = final.replace(/\.ts$/i, '');
    return `from '${cleaned}'`;
  });
}

/** Collect all .ts files under a directory */
function collectTsFiles(root) {
  const files = [];
  function recurse(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) recurse(full);
      else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
    }
  }
  recurse(root);
  return files;
}

/** Main translation workflow */
function translateProject(srcRoot) {
  const tsFiles = collectTsFiles(srcRoot);
  // Map old absolute file path → new absolute file path
  const oldToNew = new Map();
  tsFiles.forEach(oldPath => {
    const rel = path.relative(srcRoot, oldPath);
    const newRel = translatePath(rel);
    const newAbs = path.join(srcRoot, newRel);
    oldToNew.set(oldPath, newAbs);
  });

  // First pass: translate identifiers and update imports in memory
  const fileContents = new Map();
  tsFiles.forEach(oldPath => {
    let content = fs.readFileSync(oldPath, 'utf8');
    content = translateIdentifiers(content);
    content = updateImportPaths(oldPath, content, oldToNew);
    fileContents.set(oldPath, content);
  });

  // Ensure target directories exist and write new files
  for (const [oldPath, newPath] of oldToNew.entries()) {
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(newPath, fileContents.get(oldPath), 'utf8');
    // Remove old file after successful write
    fs.unlinkSync(oldPath);
  }

  // Finally, clean up any empty directories left behind
  function cleanup(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        cleanup(child);
        // remove if empty
        if (fs.readdirSync(child).length === 0) fs.rmdirSync(child);
      }
    }
  }
  cleanup(srcRoot);
}

const srcRoot = path.resolve(__dirname, '..', 'src');
console.log('Starting translation of Kinesiology Scheduler project...');
translateProject(srcRoot);
console.log('Translation finished.');

const fs = require('fs');
const path = require('path');

// Mapping for folder names (English -> Spanish with es- prefix)
const folderMap = {
  'appointments': 'es-citas',
  'health-insurances': 'es-aseguradoras-salud',
  'patients': 'es-pacientes',
  'professionals': 'es-profesionales',
  'resources': 'es-recursos',
  'treatments': 'es-tratamientos',
  'users': 'es-usuarios',
};

// Mapping for file name parts
const filePartMap = {
  'controller': 'controlador',
  'service': 'servicio',
  'entity': 'entidad',
  'module': 'modulo',
  'repository': 'repositorio',
};

// Identifier mapping (class / interface / variable names)
const identifierMap = {
  'Patient': 'Paciente',
  'CreatePatientDto': 'CrearPacienteDto',
  'UpdatePatientDto': 'ActualizarPacienteDto',
  'Clinic': 'Clinica',
  'Appointment': 'Cita',
  'CreateAppointmentDto': 'CrearCitaDto',
  'UpdateAppointmentDto': 'ActualizarCitaDto',
};

function translatePath(originalPath) {
  const isAbsolute = path.isAbsolute(originalPath);
  const parts = originalPath.split(path.sep).filter(p => p.length > 0);
  const translatedParts = parts.map(p => {
    if (folderMap[p]) return folderMap[p];
    const ext = path.extname(p);
    const base = path.basename(p, ext);
    let newBase = base;
    Object.entries(filePartMap).forEach(([eng, esp]) => {
      newBase = newBase.replace(new RegExp(eng, 'g'), esp);
    });
    if (ext === '.ts' && !newBase.startsWith('es-')) {
      newBase = 'es-' + newBase;
    }
    return newBase + ext;
  });
  const newPath = path.join(...translatedParts);
  return isAbsolute ? '/' + newPath : newPath;
}

function translateIdentifiers(content) {
  let newContent = content;
  Object.entries(identifierMap).forEach(([eng, esp]) => {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    newContent = newContent.replace(regex, esp);
  });
  return newContent;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const translatedContent = translateIdentifiers(content);
  const updatedContent = translatedContent.replace(/from\s+['"]([^'\"]+)['"]/g, (match, importPath) => {
    if (!importPath.startsWith('.')) return match;
    const absoluteImport = path.resolve(path.dirname(filePath), importPath);
    const translated = translatePath(absoluteImport);
    const newRelative = path.relative(path.dirname(filePath), translated);
    const normalized = newRelative.startsWith('..') ? newRelative : './' + newRelative;
    return `from '${normalized}'`;
  });
  fs.writeFileSync(filePath, updatedContent, 'utf8');
}

function walkAndTranslate(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndTranslate(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function renameTsFiles(root) {
  const tsFiles = [];
  function collectTs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectTs(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        tsFiles.push(fullPath);
      }
    }
  }
  collectTs(root);
  tsFiles.sort((a, b) => b.length - a.length);
  for (const file of tsFiles) {
    const newPath = translatePath(file);
    if (newPath !== file) {
      const newDir = path.dirname(newPath);
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      fs.copyFileSync(file, newPath);
      fs.unlinkSync(file);
    }
  }
}

function removeEmptyOldDirs(root) {
  const dirs = [];
  function collectDirs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        collectDirs(sub);
        dirs.push(sub);
      }
    }
  }
  collectDirs(root);
  dirs.sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    try {
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) {
        fs.rmdirSync(dir);
      }
    } catch (e) {}
  }
}

const srcRoot = path.resolve(__dirname, '..', 'src');
console.log('Translating identifiers...');
walkAndTranslate(srcRoot);
console.log('Renaming .ts files...');
renameTsFiles(srcRoot);
console.log('Cleaning up empty old directories...');
removeEmptyOldDirs(srcRoot);
console.log('Translation complete.');

const fs = require('fs');
const path = require('path');

// Mapping for folder names (English -> Spanish with es- prefix)
const folderMap = {
  'appointments': 'es-citas',
  'health-insurances': 'es-aseguradoras-salud',
  'patients': 'es-pacientes',
  'professionals': 'es-profesionales',
  'resources': 'es-recursos',
  'treatments': 'es-tratamientos',
  'users': 'es-usuarios',
};

// Mapping for file name parts
const filePartMap = {
  'controller': 'controlador',
  'service': 'servicio',
  'entity': 'entidad',
  'module': 'modulo',
  'repository': 'repositorio',
};

// Identifier mapping (class / interface / variable names)
const identifierMap = {
  'Patient': 'Paciente',
  'CreatePatientDto': 'CrearPacienteDto',
  'UpdatePatientDto': 'ActualizarPacienteDto',
  'Clinic': 'Clinica',
  'Appointment': 'Cita',
  'CreateAppointmentDto': 'CrearCitaDto',
  'UpdateAppointmentDto': 'ActualizarCitaDto',
};

function translatePath(originalPath) {
  const isAbsolute = path.isAbsolute(originalPath);
  const parts = originalPath.split(path.sep).filter(p => p.length > 0);
  const translatedParts = parts.map(p => {
    if (folderMap[p]) return folderMap[p];
    const ext = path.extname(p);
    const base = path.basename(p, ext);
    let newBase = base;
    Object.entries(filePartMap).forEach(([eng, esp]) => {
      newBase = newBase.replace(new RegExp(eng, 'g'), esp);
    });
    if (ext === '.ts' && !newBase.startsWith('es-')) {
      newBase = 'es-' + newBase;
    }
    return newBase + ext;
  });
  const newPath = path.join(...translatedParts);
  return isAbsolute ? '/' + newPath : newPath;
}

function translateIdentifiers(content) {
  let newContent = content;
  Object.entries(identifierMap).forEach(([eng, esp]) => {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    newContent = newContent.replace(regex, esp);
  });
  return newContent;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const translatedContent = translateIdentifiers(content);
  const updatedContent = translatedContent.replace(/from\s+['"]([^'\"]+)['"]/g, (match, importPath) => {
    if (!importPath.startsWith('.')) return match;
    const absoluteImport = path.resolve(path.dirname(filePath), importPath);
    const translated = translatePath(absoluteImport);
    const newRelative = path.relative(path.dirname(filePath), translated);
    const normalized = newRelative.startsWith('..') ? newRelative : './' + newRelative;
    return `from '${normalized}'`;
  });
  fs.writeFileSync(filePath, updatedContent, 'utf8');
}

function walkAndTranslate(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndTranslate(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function renameTsFiles(root) {
  const tsFiles = [];
  function collectTs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectTs(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        tsFiles.push(fullPath);
      }
    }
  }
  collectTs(root);
  tsFiles.sort((a, b) => b.length - a.length);
  for (const file of tsFiles) {
    const newPath = translatePath(file);
    if (newPath !== file) {
      const newDir = path.dirname(newPath);
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      fs.copyFileSync(file, newPath);
      fs.unlinkSync(file);
    }
  }
}

function removeEmptyOldDirs(root) {
  const dirs = [];
  function collectDirs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        collectDirs(sub);
        dirs.push(sub);
      }
    }
  }
  collectDirs(root);
  // Deepest first
  dirs.sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    try {
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) {
        fs.rmdirSync(dir);
      }
    } catch (e) {
      // ignore errors, e.g., directory already removed
    }
  }
}

const srcRoot = path.resolve(__dirname, '..', 'src');
console.log('Translating identifiers...');
walkAndTranslate(srcRoot);
console.log('Renaming .ts files...');
renameTsFiles(srcRoot);
console.log('Cleaning up empty old directories...');
removeEmptyOldDirs(srcRoot);
console.log('Translation complete.');

const fs = require('fs');
const path = require('path');

// Mapping for folder names (English -> Spanish with es- prefix)
const folderMap = {
  'appointments': 'es-citas',
  'health-insurances': 'es-aseguradoras-salud',
  'patients': 'es-pacientes',
  'professionals': 'es-profesionales',
  'resources': 'es-recursos',
  'treatments': 'es-tratamientos',
  'users': 'es-usuarios',
  // add more if needed
};

// Mapping for file name parts
const filePartMap = {
  'controller': 'controlador',
  'service': 'servicio',
  'entity': 'entidad',
  'module': 'modulo',
  'repository': 'repositorio',
};

// Identifier mapping (class / interface / variable names)
const identifierMap = {
  'Patient': 'Paciente',
  'CreatePatientDto': 'CrearPacienteDto',
  'UpdatePatientDto': 'ActualizarPacienteDto',
  'Clinic': 'Clinica',
  'Appointment': 'Cita',
  'CreateAppointmentDto': 'CrearCitaDto',
  'UpdateAppointmentDto': 'ActualizarCitaDto',
};

function translatePath(originalPath) {
  const parts = originalPath.split(path.sep);
  const translatedParts = parts.map(p => {
    // Folder translation
    if (folderMap[p]) return folderMap[p];
    // File translation (preserve extension)
    const ext = path.extname(p);
    const base = path.basename(p, ext);
    let newBase = base;
    Object.entries(filePartMap).forEach(([eng, esp]) => {
      newBase = newBase.replace(new RegExp(eng, 'g'), esp);
    });
    // Prepend es- prefix for TypeScript source files only
    if (ext === '.ts' && !newBase.startsWith('es-')) {
      newBase = 'es-' + newBase;
    }
    return newBase + ext;
  });
  return path.join(...translatedParts);
}

function translateIdentifiers(content) {
  let newContent = content;
  Object.entries(identifierMap).forEach(([eng, esp]) => {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    newContent = newContent.replace(regex, esp);
  });
  return newContent;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const translatedContent = translateIdentifiers(content);
  // Update internal relative imports to the new paths
  const updatedContent = translatedContent.replace(/from\s+['"]([^'\"]+)['"]/g, (match, importPath) => {
    if (!importPath.startsWith('.')) return match;
    const absoluteImport = path.resolve(path.dirname(filePath), importPath);
    const translated = translatePath(absoluteImport);
    const newRelative = path.relative(path.dirname(filePath), translated);
    const normalized = newRelative.startsWith('..') ? newRelative : './' + newRelative;
    return `from '${normalized}'`;
  });
  fs.writeFileSync(filePath, updatedContent, 'utf8');
}

function walkAndTranslate(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndTranslate(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function renameTsFiles(root) {
  const tsFiles = [];
  function collectTs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectTs(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        tsFiles.push(fullPath);
      }
    }
  }
  collectTs(root);
  // Deepest first to avoid path conflicts
  tsFiles.sort((a, b) => b.length - a.length);
  for (const file of tsFiles) {
    const newPath = translatePath(file);
    if (newPath !== file) {
      const newDir = path.dirname(newPath);
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      fs.copyFileSync(file, newPath);
      fs.unlinkSync(file);
    }
  }
}

function renameFolders(root) {
  const dirs = [];
  function collectDirs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        collectDirs(sub);
        dirs.push(sub);
      }
    }
  }
  collectDirs(root);
  // Deepest first
  dirs.sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    const newPath = translatePath(dir);
    if (newPath !== dir) {
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
      }
      // Move contents
      const items = fs.readdirSync(dir);
      for (const item of items) {
        fs.renameSync(path.join(dir, item), path.join(newPath, item));
      }
      fs.rmdirSync(dir);
    }
  }
}

const srcRoot = path.resolve(__dirname, '..', 'src');
console.log('Translating identifiers...');
walkAndTranslate(srcRoot);
console.log('Renaming .ts files...');
renameTsFiles(srcRoot);
console.log('Renaming folders...');
renameFolders(srcRoot);
console.log('Translation complete.');

const fs = require('fs');
const path = require('path');

// Mapping for folder names (English -> Spanish with es- prefix)
const folderMap = {
  'appointments': 'es-citas',
  'health-insurances': 'es-aseguradoras-salud',
  'patients': 'es-pacientes',
  'professionals': 'es-profesionales',
  'resources': 'es-recursos',
  'treatments': 'es-tratamientos',
  'users': 'es-usuarios',
  // add more if needed
};

// Mapping for file name parts
const filePartMap = {
  'controller': 'controlador',
  'service': 'servicio',
  'entity': 'entidad',
  'module': 'modulo',
  'repository': 'repositorio',
};

// Identifier mapping (class / interface / variable names)
const identifierMap = {
  'Patient': 'Paciente',
  'CreatePatientDto': 'CrearPacienteDto',
  'UpdatePatientDto': 'ActualizarPacienteDto',
  'Clinic': 'Clinica',
  'Appointment': 'Cita',
  'CreateAppointmentDto': 'CrearCitaDto',
  'UpdateAppointmentDto': 'ActualizarCitaDto',
};

function translatePath(originalPath) {
  const parts = originalPath.split(path.sep);
  const translatedParts = parts.map(p => {
    if (folderMap[p]) return folderMap[p];
    const ext = path.extname(p);
    const base = path.basename(p, ext);
    let newBase = base;
    Object.entries(filePartMap).forEach(([eng, esp]) => {
      newBase = newBase.replace(new RegExp(eng, 'g'), esp);
    });
    if (ext === '.ts' && !newBase.startsWith('es-')) {
      newBase = 'es-' + newBase;
    }
    return newBase + ext;
  });
  return path.join(...translatedParts);
}

function translateIdentifiers(content) {
  let newContent = content;
  Object.entries(identifierMap).forEach(([eng, esp]) => {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    newContent = newContent.replace(regex, esp);
  });
  return newContent;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const translatedContent = translateIdentifiers(content);
  const updatedContent = translatedContent.replace(/from\s+['"]([^'\"]+)['"]/g, (match, importPath) => {
    if (!importPath.startsWith('.')) return match;
    const absoluteImport = path.resolve(path.dirname(filePath), importPath);
    const translated = translatePath(absoluteImport);
    const newRelative = path.relative(path.dirname(filePath), translated);
    const normalized = newRelative.startsWith('..') ? newRelative : './' + newRelative;
    return `from '${normalized}'`;
  });
  fs.writeFileSync(filePath, updatedContent, 'utf8');
}

function walkAndTranslate(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndTranslate(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

function renameFilesAndFolders(root) {
  const files = [];
  function collectFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectFiles(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  collectFiles(root);
  files.sort((a, b) => b.length - a.length);
  for (const file of files) {
    const newPath = translatePath(file);
    if (newPath !== file) {
      const newDir = path.dirname(newPath);
      if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
      fs.copyFileSync(file, newPath);
      fs.unlinkSync(file);
    }
  }
  const dirs = [];
  function collectDirs(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = path.join(dir, entry.name);
        collectDirs(sub);
        dirs.push(sub);
      }
    }
  }
  collectDirs(root);
  dirs.sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    const newPath = translatePath(dir);
    if (newPath !== dir) {
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
      }
      const items = fs.readdirSync(dir);
      for (const item of items) {
        fs.renameSync(path.join(dir, item), path.join(newPath, item));
      }
      fs.rmdirSync(dir);
    }
  }
}

const srcRoot = path.resolve(__dirname, '..', 'src');
console.log('Translating identifiers...');
walkAndTranslate(srcRoot);
console.log('Renaming files and folders...');
renameFilesAndFolders(srcRoot);
console.log('Translation complete.');
